"""Servicio de subida de archivos a Google Drive con creación automática de carpetas."""

import pickle
from pathlib import Path
from typing import Optional
from datetime import datetime
from models import DriveConfig, PeriodInput


TOKEN_PATH = Path(__file__).parent / "data" / "drive_token.pickle"


def _get_drive_service(config: DriveConfig):
    """
    Obtiene un servicio de Google Drive autenticado.
    
    Args:
        config: Configuración de Google Drive
        
    Returns:
        Servicio de Google Drive autenticado
        
    Raises:
        Exception: Si no se puede autenticar o falta configuración
    """
    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
    except ImportError:
        raise Exception("Librerías de Google Drive no instaladas. Ejecuta: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
    
    if not config.oauth_credentials.get("installed", {}).get("client_id"):
        raise Exception("Credenciales OAuth de Google no configuradas. Configúralas en el archivo .env o en la interfaz.")
    
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    
    creds = None
    
    # Cargar token guardado si existe
    if TOKEN_PATH.exists():
        with open(TOKEN_PATH, 'rb') as token:
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
        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_PATH, 'wb') as token:
            pickle.dump(creds, token)
    
    # Construir y retornar servicio
    return build('drive', 'v3', credentials=creds)


def _get_or_create_folder(service, folder_name: str, parent_id: str) -> tuple[str, str]:
    """
    Busca una carpeta por nombre dentro de un padre.
    Si no existe, la crea.
    
    Returns:
        tuple[str, str]: (ID de la carpeta, URL de la carpeta)
    """
    try:
        print(f"[DRIVE DEBUG] Buscando carpeta '{folder_name}' en parent {parent_id}")
        # Buscar carpeta existente
        query = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name, webViewLink)',
            pageSize=1,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
        ).execute()
        
        items = results.get('files', [])
        print(f"[DRIVE DEBUG] Encontradas: {len(items)}")
        if items:
            folder_id = items[0]['id']
            folder_url = items[0].get('webViewLink', f'https://drive.google.com/drive/folders/{folder_id}')
            print(f"[DRIVE DEBUG] Reutilizando carpeta {folder_name} -> {folder_id}")
            return folder_id, folder_url
        
        # Crear carpeta si no existe
        print(f"[DRIVE DEBUG] No existe, creando '{folder_name}' bajo {parent_id}")
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(
            body=file_metadata,
            fields='id, webViewLink',
            supportsAllDrives=True,
        ).execute()
        
        folder_id = folder.get('id')
        folder_url = folder.get('webViewLink', f'https://drive.google.com/drive/folders/{folder_id}')
        print(f"[DRIVE DEBUG] Creada carpeta {folder_name} -> {folder_id}")
        return folder_id, folder_url
        
    except Exception as e:
        print(f"[DRIVE ERROR] {folder_name} en {parent_id}: {e}")
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


def _get_unique_filename(service, base_filename: str, parent_id: str) -> str:
    """
    Genera un nombre único para un archivo si ya existe en la carpeta.
    Si el archivo existe, agrega un sufijo (1), (2), etc.
    
    Args:
        service: Servicio de Google Drive autenticado
        base_filename: Nombre base del archivo (ej: "reporte.xlsx")
        parent_id: ID de la carpeta padre
    
    Returns:
        str: Nombre único del archivo
    """
    try:
        # Separar nombre y extensión
        if '.' in base_filename:
            name_parts = base_filename.rsplit('.', 1)
            name_without_ext = name_parts[0]
            extension = '.' + name_parts[1]
        else:
            name_without_ext = base_filename
            extension = ''
        
        # Buscar archivos con el mismo nombre en la carpeta
        query = f"name='{base_filename}' and '{parent_id}' in parents and trashed=false"
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)',
            pageSize=1,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
        ).execute()
        
        items = results.get('files', [])
        
        # Si no existe, retornar el nombre original
        if not items:
            print(f"[DRIVE DEBUG] Archivo '{base_filename}' no existe, usando nombre original")
            return base_filename
        
        # Si existe, buscar el siguiente número disponible
        print(f"[DRIVE DEBUG] Archivo '{base_filename}' ya existe, buscando nombre único...")
        counter = 1
        while True:
            new_name = f"{name_without_ext} ({counter}){extension}"
            query = f"name='{new_name}' and '{parent_id}' in parents and trashed=false"
            results = service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)',
                pageSize=1,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            ).execute()
            
            items = results.get('files', [])
            if not items:
                print(f"[DRIVE DEBUG] Nombre único encontrado: '{new_name}'")
                return new_name
            
            counter += 1
            
            # Límite de seguridad para evitar bucles infinitos
            if counter > 1000:
                raise Exception("No se pudo encontrar un nombre único después de 1000 intentos")
                
    except Exception as e:
        print(f"[DRIVE ERROR] Error al buscar nombre único: {e}")
        # En caso de error, retornar el nombre original
        return base_filename


def share_folder_with_emails(
    service,
    folder_id: str,
    emails: list[str],
    role: str = "reader"
) -> tuple[bool, str]:
    """
    Comparte una carpeta de Drive con una lista de emails.
    
    Args:
        service: Servicio de Google Drive autenticado
        folder_id: ID de la carpeta a compartir
        emails: Lista de correos electrónicos
        role: Rol de acceso ('reader', 'writer', 'commenter')
    
    Returns:
        tuple[bool, str]: (éxito, mensaje)
    """
    if not emails:
        return True, "No hay emails para compartir"
    
    try:
        shared_count = 0
        for email in emails:
            if not email or not email.strip():
                continue
            
            try:
                permission = {
                    'type': 'user',
                    'role': role,
                    'emailAddress': email.strip()
                }
                service.permissions().create(
                    fileId=folder_id,
                    body=permission,
                    sendNotificationEmail=False,
                    supportsAllDrives=True,
                ).execute()
                shared_count += 1
                print(f"[DRIVE DEBUG] Compartida carpeta con {email.strip()} (role: {role})")
            except Exception as e:
                print(f"[DRIVE ERROR] No se pudo compartir con {email.strip()}: {e}")
        
        return True, f"Carpeta compartida con {shared_count} usuario(s)"
    except Exception as e:
        return False, f"Error al compartir carpeta: {str(e)}"


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
        from googleapiclient.http import MediaFileUpload
    except ImportError:
        return False, "Librerías de Google Drive no instaladas. Ejecuta: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
    
    if not config.oauth_credentials.get("installed", {}).get("client_id"):
        return False, "Credenciales OAuth de Google no configuradas. Configúralas en el archivo .env o en la interfaz."
    
    try:
        # Obtener servicio autenticado usando la función auxiliar
        service = _get_drive_service(config)
        
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
        
        # Obtener un nombre único para el archivo si ya existe
        unique_filename = _get_unique_filename(service, file_path.name, query_folder_id)
        
        # Subir archivo con el nombre único
        file_metadata = {
            'name': unique_filename,
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
