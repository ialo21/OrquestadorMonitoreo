# Configuración de Autenticación de Windows para SQL Server

## Requisitos

Para usar autenticación de Windows con SQL Server, necesitas instalar `pyodbc` y tener un driver ODBC de SQL Server instalado en tu sistema.

## Instalación de pyodbc

### Opción 1: Instalar desde wheel precompilado (Recomendado)

Si tienes Python 3.13 o anterior:

```bash
pip install pyodbc
```

### Opción 2: Para Python 3.14+

Si tienes Python 3.14 y la instalación falla, puedes:

1. **Esperar a que haya wheels precompilados** para Python 3.14 (próximamente)
2. **Downgrade a Python 3.13** (recomendado para producción)
3. **Compilar desde fuente** (requiere Visual Studio Build Tools)

Para compilar desde fuente:
- Instala [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
- Asegúrate de tener el componente "Desarrollo de escritorio con C++"
- Ejecuta: `pip install pyodbc`

## Instalación del Driver ODBC de SQL Server

### Windows

Descarga e instala uno de estos drivers:

1. **ODBC Driver 17 for SQL Server** (Recomendado)
   - [Descargar](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)

2. **ODBC Driver 13 for SQL Server** (Alternativa)
   - Incluido en SQL Server Management Studio (SSMS)

3. **SQL Server Native Client** (Legado)
   - Incluido en instalaciones antiguas de SQL Server

## Configuración en la Aplicación

1. Ve a la pestaña **"Bases de Datos"**
2. Crea o edita una base de datos SQL Server
3. En el campo **"Autenticación"**, selecciona **"Windows"**
4. Guarda los cambios

## Probar la Conexión

1. En la tarjeta de la base de datos, haz clic en **"Probar"**
2. No se solicitarán credenciales (usa tu sesión actual de Windows)
3. Si la conexión es exitosa, verás un mensaje de confirmación

## Solución de Problemas

### Error: "pyodbc no está instalado"

Instala pyodbc siguiendo las instrucciones anteriores.

### Error: "ODBC Driver 17 for SQL Server not found"

- Instala el driver ODBC de SQL Server
- O actualiza el código para usar un driver alternativo

### Error: "Login failed for user"

- Verifica que tu usuario de Windows tenga permisos en el SQL Server
- Asegúrate de que el SQL Server esté configurado para aceptar autenticación de Windows
- Verifica que estés en el mismo dominio o red del servidor

### Error de compilación al instalar pyodbc

Si estás usando Python 3.14:
1. Considera usar Python 3.13 (más estable para producción)
2. O espera a que haya wheels precompilados para Python 3.14
3. O instala Visual Studio Build Tools para compilar desde fuente

## Alternativa: Usar Autenticación SQL

Si no puedes instalar pyodbc o configurar Windows Authentication:

1. Usa **"Autenticación SQL"** en lugar de "Windows"
2. Proporciona usuario y contraseña al ejecutar queries
3. Funciona con `pymssql` (ya instalado por defecto)

## Notas Técnicas

- **pymssql** no soporta Windows Authentication
- **pyodbc** es necesario específicamente para Windows Authentication
- Para autenticación SQL, no necesitas pyodbc (usa pymssql)
- La aplicación detecta automáticamente si pyodbc está disponible
