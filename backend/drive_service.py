"""Servicio de subida de archivos a Google Drive con creación automática de carpetas."""

import os
from pathlib import Path
from typing import Optional
from datetime import datetime
from models import DriveConfig, PeriodInput


def _get_or_create_folder(service, folder_name: str, parent_id: str) -> Optional[str]:
    """
    Busca una carpeta por nombre dentro de un padre.
    Si no existe, la crea.
    
    Returns:
        str: ID de la carpeta encontrada o creada
    """
    try:
        # Buscar carpeta existente
        query = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)',
            pageSize=1
        ).execute()
        
        items = results.get('files', [])
        if items:
            return items[0]['id']
        
        # Crear carpeta si no existe
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(
            body=file_metadata,
            fields='id'
        ).execute()
        
        return folder.get('id')
        
    except Exception as e:
        raise Exception(f"Error al crear/buscar carpeta '{folder_name}': {str(e)}")


def upload_to_drive(
    config: DriveConfig,
    file_path: Path,
    query_name: str,
    execution_date: datetime,
    period: Optional[PeriodInput] = None,
) -> tuple[bool, str]:
    """
    Sube un archivo a Google Drive siguiendo la estructura:
    base_folder / mes_año / fecha_ejecución / query_name / archivo
    
    Args:
        config: Configuración de Google Drive
        file_path: Ruta del archivo a subir
        query_name: Nombre de la query
        execution_date: Fecha de ejecución
        period: Periodo de cierre (para nombrar la carpeta del mes)
    
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
        import pickle
    except ImportError:
        return False, "Librerías de Google Drive no instaladas. Ejecuta: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
    
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    
    try:
        # Autenticación
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
                if not config.credentials_file or not os.path.exists(config.credentials_file):
                    return False, "Archivo de credenciales de Google no encontrado. Configura 'credentials_file' con la ruta al archivo credentials.json"
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    config.credentials_file, SCOPES)
                creds = flow.run_local_server(port=0)
            
            # Guardar credenciales para la próxima vez
            token_path.parent.mkdir(parents=True, exist_ok=True)
            with open(token_path, 'wb') as token:
                pickle.dump(creds, token)
        
        # Construir servicio
        service = build('drive', 'v3', credentials=creds)
        
        # Crear estructura de carpetas
        # 1. Carpeta del mes (ej: "Diciembre 2025")
        if period:
            meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                     "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            month_folder = f"{meses[period.month - 1]} {period.year}"
        else:
            month_folder = execution_date.strftime("%B %Y")
        
        month_folder_id = _get_or_create_folder(service, month_folder, config.base_folder_id)
        
        # 2. Carpeta de fecha de ejecución (ej: "2025-12-15")
        date_folder = execution_date.strftime("%Y-%m-%d")
        date_folder_id = _get_or_create_folder(service, date_folder, month_folder_id)
        
        # 3. Carpeta de la query
        query_folder_id = _get_or_create_folder(service, query_name, date_folder_id)
        
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
        return True, f"Archivo subido a Drive: {file_url}"
        
    except Exception as e:
        return False, f"Error al subir a Drive: {str(e)}"
