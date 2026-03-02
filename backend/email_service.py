"""Servicio de envío de correos electrónicos usando OAuth de Google (Gmail API)."""

import os
import pickle
import base64
from email.mime.text import MIMEText
from datetime import datetime
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from models import EmailConfig, PeriodInput

# Alcances necesarios para enviar correos
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

# Ruta al archivo de token
DATA_DIR = Path(__file__).parent / "data"
TOKEN_FILE = DATA_DIR / "gmail_token.pickle"


def _get_gmail_service(credentials_data: dict):
    """
    Obtiene el servicio de Gmail autenticado usando OAuth.
    
    Args:
        credentials_data: Diccionario con client_id, client_secret, etc.
    
    Returns:
        Servicio de Gmail autenticado
    """
    creds = None
    
    # Cargar token si existe
    if TOKEN_FILE.exists():
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
    
    # Si no hay credenciales válidas, autenticar
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            # Refrescar token expirado
            creds.refresh(Request())
        else:
            # Flujo de autenticación OAuth
            flow = InstalledAppFlow.from_client_config(
                credentials_data,
                SCOPES
            )
            creds = flow.run_local_server(port=0)
        
        # Guardar token para futuros usos
        DATA_DIR.mkdir(exist_ok=True)
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
    
    return build('gmail', 'v1', credentials=creds)


def _replace_variables(
    template: str,
    execution_date: datetime,
    queries_executed: list[str],
    period: Optional[PeriodInput] = None,
    execution_status: str = "",
    total_queries: int = 0,
    completed_queries: int = 0,
    drive_folder_urls: Optional[list[str]] = None,
    drive_folder_level: int = -1,
) -> str:
    """
    Reemplaza variables en una plantilla de email.
    
    Variables disponibles:
    - {{FECHA_EJECUCION}}: Fecha y hora de ejecución
    - {{QUERIES_EJECUTADAS}}: Lista de queries ejecutadas
    - {{PERIODO}}: Periodo de cierre (si aplica)
    - {{TOTAL_QUERIES}}: Número total de queries
    - {{QUERIES_COMPLETADAS}}: Número de queries completadas
    - {{ESTADO}}: Estado de la ejecución
    - {{CARPETA_DRIVE}}: URL de la carpeta Drive según configuración
    """
    result = template
    
    # Fecha de ejecución
    fecha_str = execution_date.strftime("%d/%m/%Y %H:%M:%S")
    result = result.replace("{{FECHA_EJECUCION}}", fecha_str)
    
    # Lista de queries
    if queries_executed:
        queries_list = "\n".join([f"  • {q}" for q in queries_executed])
    else:
        queries_list = "  (ninguna)"
    result = result.replace("{{QUERIES_EJECUTADAS}}", queries_list)
    
    # Periodo
    if period:
        meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        periodo_str = f"{meses[period.month - 1]} {period.year}"
    else:
        periodo_str = "N/A"
    result = result.replace("{{PERIODO}}", periodo_str)
    
    # Totales
    result = result.replace("{{TOTAL_QUERIES}}", str(total_queries))
    result = result.replace("{{QUERIES_COMPLETADAS}}", str(completed_queries))
    result = result.replace("{{ESTADO}}", execution_status)
    
    # Carpeta Drive
    if drive_folder_urls and len(drive_folder_urls) > 0:
        try:
            # Usar el nivel configurado (soporta índices negativos)
            folder_url = drive_folder_urls[drive_folder_level]
        except (IndexError, TypeError):
            # Si el índice no es válido, usar la última carpeta
            folder_url = drive_folder_urls[-1] if drive_folder_urls else "N/A"
    else:
        folder_url = "N/A"
    result = result.replace("{{CARPETA_DRIVE}}", folder_url)
    
    return result


def send_email(
    config: EmailConfig,
    to_addresses: list[str],
    cc_addresses: list[str],
    subject: str,
    body: str,
) -> None:
    """
    Envía un correo electrónico usando Gmail API con OAuth.
    
    Args:
        config: Configuración de email con credenciales OAuth
        to_addresses: Lista de destinatarios principales
        cc_addresses: Lista de destinatarios en copia
        subject: Asunto del correo
        body: Cuerpo del correo (puede contener variables)
    
    Raises:
        Exception: Si hay un error al enviar el correo
    """
    if not to_addresses:
        raise ValueError("Debe especificar al menos un destinatario")
    
    try:
        # Obtener servicio de Gmail
        service = _get_gmail_service(config.oauth_credentials)
        
        # Crear mensaje
        message = MIMEText(body, 'plain', 'utf-8')
        message['To'] = ', '.join(to_addresses)
        if cc_addresses:
            message['Cc'] = ', '.join(cc_addresses)
        message['Subject'] = subject
        
        # Codificar mensaje
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        # Enviar
        service.users().messages().send(
            userId='me',
            body={'raw': raw_message}
        ).execute()
        
    except HttpError as e:
        raise Exception(f"Error de Gmail API: {str(e)}")
    except Exception as e:
        raise Exception(f"Error al enviar correo: {str(e)}")


def send_start_email(
    config: EmailConfig,
    execution_date: datetime,
    queries: list[str],
    period: Optional[PeriodInput] = None,
) -> tuple[bool, str]:
    """Envía el email de inicio de ejecución."""
    if not config.enabled or not config.send_start_email:
        return True, "Email de inicio deshabilitado"
    
    # Reemplazar variables en subject y body
    subject = _replace_variables(
        config.start_email_subject,
        execution_date,
        queries,
        period,
        execution_status="Iniciando",
        total_queries=len(queries),
        completed_queries=0,
    )
    
    body = _replace_variables(
        config.start_email_body,
        execution_date,
        queries,
        period,
        execution_status="Iniciando",
        total_queries=len(queries),
        completed_queries=0,
    )
    
    try:
        send_email(
            config,
            config.start_email_to,
            config.start_email_cc,
            subject,
            body,
        )
        return True, "Email de inicio enviado"
    except Exception as e:
        return False, str(e)


def send_end_email(
    config: EmailConfig,
    execution_date: datetime,
    queries: list[str],
    execution_status: str,
    total_queries: int,
    completed_queries: int,
    period: Optional[PeriodInput] = None,
    drive_folder_urls: Optional[list[str]] = None,
) -> tuple[bool, str]:
    """Envía el email de fin de ejecución."""
    if not config.enabled or not config.send_end_email:
        return True, "Email de fin deshabilitado"
    
    # Reemplazar variables en subject y body
    subject = _replace_variables(
        config.end_email_subject,
        execution_date,
        queries,
        period,
        execution_status=execution_status,
        total_queries=total_queries,
        completed_queries=completed_queries,
        drive_folder_urls=drive_folder_urls,
        drive_folder_level=config.drive_folder_level,
    )
    
    body = _replace_variables(
        config.end_email_body,
        execution_date,
        queries,
        period,
        execution_status=execution_status,
        total_queries=total_queries,
        completed_queries=completed_queries,
        drive_folder_urls=drive_folder_urls,
        drive_folder_level=config.drive_folder_level,
    )
    
    try:
        send_email(
            config,
            config.end_email_to,
            config.end_email_cc,
            subject,
            body,
        )
        return True, "Email de fin enviado"
    except Exception as e:
        return False, str(e)
