"""Servicio de subida de archivos a Google Drive con creación automática de carpetas."""

import pickle
from pathlib import Path
from typing import Optional
from datetime import datetime
from models import DriveConfig, PeriodInput


TOKEN_PATH = Path(__file__).parent / "data" / "drive_token.pickle"


def _get_or_create_folder(service, folder_name: str, parent_id: str) -> tuple[str, str]:
    """
    Busca una carpeta por nombre dentro de un padre.
    Si no existe, la crea.
    
    Returns:
        tuple[str, str]: (ID de la carpeta, URL de la carpeta)
    """
    try:
        # Buscar carpeta existente
        query = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name, webViewLink)',
            pageSize=1
        ).execute()
        
        items = results.get('files', [])
        if items:
            folder_id = items[0]['id']
            folder_url = items[0].get('webViewLink', f'https://drive.google.com/drive/folders/{folder_id}')
            return folder_id, folder_url
        
        # Crear carpeta si no existe
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(
            body=file_metadata,
            fields='id, webViewLink'
        ).execute()
        
        folder_id = folder.get('id')
        folder_url = folder.get('webViewLink', f'https://drive.google.com/drive/folders/{folder_id}')
        return folder_id, folder_url
        
    except Exception as e:
        raise Exception(f"Error al crear/buscar carpeta '{folder_name}': {str(e)}")


def drive_token_exists() -> bool:
    """Indica si ya existe un token OAuth guardado para Drive."""
    return TOKEN_PATH.exists()


def run_drive_authorization(config: DriveConfig) -> tuple[bool, str]:
    """Ejecuta el flujo OAuth para obtener/renovar token de Drive sin subir archivos."""
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        return False, "Librerías de Google Drive no instaladas. Ejecuta: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"

    if not config.oauth_credentials.get("installed", {}).get("client_id"):
        return False, "Credenciales OAuth de Google no configuradas. Configúralas en .env o en la interfaz"

    SCOPES = ['https://www.googleapis.com/auth/drive.file']

    try:
        flow = InstalledAppFlow.from_client_config(config.oauth_credentials, SCOPES)
        creds = flow.run_local_server(port=0)

        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_PATH, 'wb') as token:
            pickle.dump(creds, token)

        return True, "Token de Drive guardado exitosamente"
    except Exception as e:
        return False, f"Error durante la autorización de Drive: {str(e)}"


def upload_to_drive(
    config: DriveConfig,
    file_path: Path,
    query_name: str,
    execution_date: datetime,
    period: Optional[PeriodInput] = None,
) -> tuple[bool, str]:
    """
    Sube un archivo a Google Drive siguiendo la estructura de carpetas personalizable.
    
    Args:
        config: Configuración de Google Drive
        file_path: Ruta del archivo a subir
        query_name: Nombre de la query
        execution_date: Fecha de ejecución
        period: Periodo de cierre (para nombrar carpetas con variables de mes)
    
    Returns:
        tuple[bool, str]: (éxito, mensaje/url del archivo)
    """
    if not config.enabled:
        return True, "Google Drive deshabilitado"
    
    if not file_path.exists():
        return False, f"Archivo no encontrado: {file_path}"
    
    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError:
        return False, "Librerías de Google Drive no instaladas. Ejecuta: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
    
    if not config.oauth_credentials.get("installed", {}).get("client_id"):
        return False, "Credenciales OAuth de Google no configuradas. Configúralas en el archivo .env o en la interfaz."
    
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    
    try:
        # Autenticación usando OAuth (igual que email_service)
        creds = None
        token_path = Path(__file__).parent / 'data' / 'drive_token.pickle'
        
        # Cargar token guardado si existe
        if token_path.exists():
            with open(token_path, 'rb') as token:
                creds = pickle.load(token)
        
        # Si no hay credenciales válidas, obtener nuevas
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                # Flujo OAuth usando credenciales del config
                flow = InstalledAppFlow.from_client_config(
                    config.oauth_credentials,
                    SCOPES
                )
                creds = flow.run_local_server(port=0)
            
            # Guardar credenciales para la próxima vez
            token_path.parent.mkdir(parents=True, exist_ok=True)
            with open(token_path, 'wb') as token:
                pickle.dump(creds, token)
        
        # Construir servicio
        service = build('drive', 'v3', credentials=creds)
        
        # Preparar variables para reemplazo en estructura de carpetas
        meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        
        if period:
            mes_nombre = meses[period.month - 1]
            mes_num = str(period.month).zfill(2)
            año = str(period.year)
        else:
            mes_nombre = meses[execution_date.month - 1]
            mes_num = str(execution_date.month).zfill(2)
            año = str(execution_date.year)
        
        fecha = execution_date.strftime("%Y-%m-%d")
        
        variables = {
            "{MES_NOMBRE}": mes_nombre,
            "{MES_NUM}": mes_num,
            "{AÑO}": año,
            "{FECHA}": fecha,
            "{QUERY_NAME}": query_name,
        }
        
        # Crear estructura de carpetas personalizable
        current_parent_id = config.base_folder_id
        folder_urls = []  # URLs de todas las carpetas creadas en orden
        
        for folder_template in config.folder_structure:
            # Reemplazar variables en el template
            folder_name = folder_template
            for var, value in variables.items():
                folder_name = folder_name.replace(var, value)
            
            # Crear o encontrar la carpeta
            current_parent_id, folder_url = _get_or_create_folder(service, folder_name, current_parent_id)
            folder_urls.append(folder_url)
        
        # La última carpeta creada es donde se sube el archivo
        query_folder_id = current_parent_id
        
        # Subir archivo
        file_metadata = {
            'name': file_path.name,
            'parents': [query_folder_id]
        }
        
        media = MediaFileUpload(
            str(file_path),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()
        
        file_url = file.get('webViewLink', '')
        # Retornar éxito y un diccionario con URLs
        result = {
            "file_url": file_url,
            "folder_urls": folder_urls,  # Lista de URLs de carpetas en orden de estructura
        }
        return True, result
        
    except Exception as e:
        return False, f"Error al subir a Drive: {str(e)}"
