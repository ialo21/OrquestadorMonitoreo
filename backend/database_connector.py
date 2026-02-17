"""Gestión de conexiones a bases de datos PostgreSQL y SQL Server."""

import psycopg2
import pymssql
import pandas as pd
from models import DatabaseConfig, CredentialInput


def _get_sqlserver_drivers():
    """Obtiene la lista de controladores ODBC de SQL Server instalados (si pyodbc está disponible)."""
    try:
        import pyodbc
        all_drivers = pyodbc.drivers()
        preferred = [
            "ODBC Driver 18 for SQL Server",
            "ODBC Driver 17 for SQL Server",
            "ODBC Driver 13 for SQL Server",
            "ODBC Driver 11 for SQL Server",
            "SQL Server Native Client 11.0",
            "SQL Server",
        ]
        found = []
        for name in preferred:
            if name in all_drivers:
                found.append(name)
        others = [d for d in all_drivers if d not in found and "SQL" in d.upper()]
        return found + others
    except ImportError:
        return []


def get_connection(db_config: DatabaseConfig, credentials: CredentialInput):
    """Obtiene una conexión a la base de datos según su tipo."""
    if db_config.db_type == "postgresql":
        return psycopg2.connect(
            host=db_config.host,
            port=db_config.port,
            dbname=db_config.database,
            user=credentials.username,
            password=credentials.password,
            connect_timeout=15,
        )
    elif db_config.db_type == "sqlserver":
        # Verificar si usa autenticación de Windows
        auth_type = getattr(db_config, 'auth_type', 'sql')
        
        if auth_type == "windows":
            try:
                import pyodbc
            except ImportError:
                raise Exception(
                    "pyodbc no está instalado. Para usar autenticación de Windows, "
                    "instala pyodbc: pip install pyodbc"
                )
            drivers = _get_sqlserver_drivers()
            if not drivers:
                raise Exception(
                    "No hay ningún controlador ODBC de SQL Server instalado en esta máquina. "
                    "Descarga e instala 'Microsoft ODBC Driver for SQL Server' desde: "
                    "https://learn.microsoft.com/es-es/sql/connect/odbc/download-odbc-driver-for-sql-server"
                )
            base = f"SERVER={db_config.host},{db_config.port};DATABASE={db_config.database};Connection Timeout=15;"
            username = (credentials.username or "").strip()
            password = credentials.password or ""
            if username and password:
                auth_part = f"UID={username};PWD={password};"
            else:
                auth_part = "Trusted_Connection=yes;"
            last_error = None
            for driver_name in drivers:
                driver = "{" + driver_name + "}" if not driver_name.startswith("{") else driver_name
                conn_str = f"DRIVER={driver};{base}{auth_part}"
                try:
                    return pyodbc.connect(conn_str)
                except pyodbc.Error as e:
                    last_error = e
                    error_str = str(e)
                    if "IM002" in error_str or "Data source name not found" in error_str:
                        continue
                    raise Exception(
                        f"Error de autenticación de Windows: {str(e)}. "
                        "Si tu PC no está en el dominio, indica usuario y contraseña de dominio (ej: DOMINIO\\usuario)."
                    )
            if last_error is not None:
                err_str = str(last_error)
                if "IM002" in err_str or "Data source name not found" in err_str:
                    raise Exception(
                        "No se encontró un controlador ODBC de SQL Server en esta máquina. "
                        "Instala 'Microsoft ODBC Driver for SQL Server' (64 bits si tu Python es 64 bits): "
                        "https://learn.microsoft.com/es-es/sql/connect/odbc/download-odbc-driver-for-sql-server"
                    )
                raise Exception(
                    f"Error de conexión: {str(last_error)}. "
                    "Si tu PC no está en el dominio, usa usuario y contraseña de dominio (ej: DOMINIO\\usuario)."
                )
            raise Exception("No se pudo conectar con ningún controlador ODBC disponible.")
        else:
            # Autenticación SQL tradicional con pymssql
            return pymssql.connect(
                server=db_config.host,
                port=str(db_config.port),
                database=db_config.database,
                user=credentials.username,
                password=credentials.password,
                login_timeout=15,
            )
    else:
        raise ValueError(f"Tipo de base de datos no soportado: {db_config.db_type}")


def test_connection(db_config: DatabaseConfig, credentials: CredentialInput) -> tuple[bool, str]:
    """Prueba la conexión a una base de datos. Retorna (éxito, mensaje)."""
    try:
        conn = get_connection(db_config, credentials)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        return True, f"Conexión exitosa a {db_config.name} ({db_config.host}:{db_config.port}/{db_config.database})"
    except Exception as e:
        return False, f"Error de conexión: {str(e)}"


def execute_query(
    db_config: DatabaseConfig,
    credentials: CredentialInput,
    sql: str,
) -> pd.DataFrame:
    """Ejecuta una query y retorna los resultados como DataFrame."""
    conn = get_connection(db_config, credentials)
    try:
        df = pd.read_sql_query(sql, conn)
        return df
    finally:
        conn.close()
