# Configuración de Email y Google Drive

Este documento describe cómo configurar el envío automático de correos electrónicos y la subida a Google Drive para los resultados de ejecución de queries.

## Configuración de Envío de Correos

El orquestador puede enviar correos automáticamente al inicio y fin de cada ejecución de reportes usando **OAuth de Google**.

### 1. Habilitar el envío de correos

1. Ve a la pestaña **Configuración** en la interfaz web
2. Selecciona la sección **Correos Electrónicos**
3. Marca la casilla **"Habilitar envío de correos"**

### 2. Configurar credenciales OAuth de Google

El sistema usa OAuth de Google para enviar correos de forma segura. Solo necesitas iniciar sesión una vez.

#### Crear credenciales en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto
3. Habilita la **Gmail API**
4. Crea credenciales OAuth 2.0:
   - Tipo: Aplicación de escritorio
   - Descarga el JSON de credenciales
5. Anota los valores de `client_id`, `client_secret` y `project_id`

#### Configurar en el servidor (Recomendado)

Crea un archivo `.env` en la raíz del proyecto con:

```bash
GOOGLE_OAUTH_CLIENT_ID=tu_client_id_aqui
GOOGLE_OAUTH_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_OAUTH_PROJECT_ID=tu_project_id_aqui
```

**Ventajas**:
- No se guardan secretos en el repositorio
- Más seguro para entornos de producción
- Las credenciales se cargan automáticamente

#### Configurar desde la interfaz (Alternativa)

También puedes ingresar las credenciales directamente en la interfaz web:
1. Ve a **Configuración** → **Correos Electrónicos**
2. Ingresa `client_id`, `client_secret` y `project_id`
3. Guarda la configuración

**Nota**: Si existen credenciales en el `.env`, estas tendrán prioridad sobre las de la interfaz.

### 3. Primera autorización

La primera vez que envíes un correo de prueba o ejecutes reportes:

1. Se abrirá automáticamente una ventana del navegador
2. Inicia sesión con tu cuenta de Google
3. Acepta los permisos solicitados
4. El token de acceso se guardará en `backend/data/gmail_token.pickle`

**Nota**: Este paso solo se realiza una vez. Los accesos futuros usarán el token guardado automáticamente.

### 4. Configurar email de inicio

1. Marca **"Enviar email al iniciar ejecución"**
2. Agrega destinatarios en **Para** (obligatorio)
3. Opcionalmente agrega destinatarios en **CC**
4. Personaliza el **Asunto** y **Cuerpo del mensaje**

### 4. Configurar email de fin

1. Marca **"Enviar email al finalizar ejecución"**
2. Configura destinatarios, asunto y cuerpo del mensaje

### Variables disponibles

Puedes usar las siguientes variables en el asunto y cuerpo de los correos:

- `{{FECHA_EJECUCION}}` - Fecha y hora de la ejecución
- `{{QUERIES_EJECUTADAS}}` - Lista de nombres de queries ejecutadas
- `{{PERIODO}}` - Periodo de cierre seleccionado (mes y año)
- `{{TOTAL_QUERIES}}` - Número total de queries en la ejecución
- `{{QUERIES_COMPLETADAS}}` - Número de queries completadas exitosamente
- `{{ESTADO}}` - Estado final de la ejecución (solo en email de fin)

#### Ejemplo de cuerpo de email

```
Hola,

Se ha iniciado la ejecución de reportes mensuales.

Fecha de ejecución: {{FECHA_EJECUCION}}
Periodo: {{PERIODO}}

Queries programadas ({{TOTAL_QUERIES}}):
{{QUERIES_EJECUTADAS}}

Este proceso se ejecuta automáticamente.
```

### 5. Probar la configuración

1. Haz clic en **"Enviar Email de Prueba"** para verificar que la configuración OAuth es correcta
2. Si es la primera vez, se abrirá una ventana del navegador para autorizar
3. Revisa tu bandeja de entrada para confirmar la recepción del correo

### 6. Guardar

Haz clic en **"Guardar Configuración"** para aplicar los cambios.

---

## Configuración de Google Drive

El orquestador puede subir automáticamente los archivos Excel resultantes a Google Drive, organizándolos en una **estructura de carpetas completamente personalizable**.

### Estructura de carpetas personalizable

Puedes definir la jerarquía de carpetas usando variables:

**Variables disponibles:**
- `{MES_NOMBRE}` - Nombre del mes (ej: Diciembre)
- `{MES_NUM}` - Número del mes con cero (ej: 12)
- `{AÑO}` - Año (ej: 2025)
- `{FECHA}` - Fecha completa (ej: 2025-12-15)
- `{QUERY_NAME}` - Nombre de la query

**Estructura por defecto:**
```
📁 Carpeta Base (configurada arriba)
 └─ 📁 {MES_NOMBRE} {AÑO}        → Diciembre 2025
     └─ 📁 {FECHA}                 → 2025-12-15
         └─ 📁 {QUERY_NAME}        → Reporte Recibo Caja
             └─ 📄 Archivo.xlsx
```

**Ejemplos de personalización:**
- Agrupación simple por mes: `["{MES_NOMBRE} {AÑO}", "{QUERY_NAME}"]`
- Por año y mes: `["{AÑO}", "{MES_NUM}-{MES_NOMBRE}", "{FECHA}", "{QUERY_NAME}"]`
- Solo por fecha: `["{FECHA}", "{QUERY_NAME}"]`

Las carpetas se crean automáticamente si no existen.

### 1. Configurar credenciales OAuth de Google

Google Drive usa las **mismas credenciales OAuth que el email**. Si ya configuraste el email, ¡no necesitas hacer nada más!

#### Configurar en el servidor (Recomendado)

Si aún no lo has hecho, crea un archivo `.env` en la raíz del proyecto:

```bash
GOOGLE_OAUTH_CLIENT_ID=tu_client_id_aqui
GOOGLE_OAUTH_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_OAUTH_PROJECT_ID=tu_project_id_aqui
```

**Ventajas**:
- Las credenciales se cargan automáticamente para email Y Drive
- No se guardan secretos en el repositorio
- Más seguro para entornos de producción

#### Crear credenciales (si no las tienes)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o usa el existente
3. Habilita **Gmail API** y **Google Drive API**
4. Crea credenciales OAuth 2.0 tipo "Aplicación de escritorio"
5. Descarga el JSON y extrae `client_id`, `client_secret` y `project_id`
6. Agégalos al archivo `.env`

### 2. Configurar carpeta base y estructura

1. Ve a **Configuración** → **Google Drive**
2. Marca **"Habilitar subida a Google Drive"**
3. Configura:
   - **ID de carpeta base**: Obtén el ID desde la URL de Drive
     - URL: `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`
     - ID: `1a2b3c4d5e6f7g8h9i0j`
   - **Estructura de carpetas**: Personaliza los niveles de subcarpetas (ver sección anterior)

### 3. Primera autorización

La primera vez que se ejecute una query con Google Drive habilitado:

1. El servidor abrirá una ventana de navegador para autorizar el acceso
2. Inicia sesión con tu cuenta de Google
3. Acepta los permisos solicitados
4. El token se guardará automáticamente en `backend/data/drive_token.pickle`

**Nota**: Este paso solo se realiza una vez. Los accesos futuros usarán el token guardado.

### 4. Guardar configuración

Haz clic en **"Guardar Configuración"** para aplicar los cambios.

---

## Instalación de Dependencias

### Backend

Las nuevas dependencias ya están incluidas en `requirements.txt`:

```bash
cd backend
pip install -r requirements.txt
```

Esto instalará:
- `google-api-python-client` - Cliente de Google Drive API
- `google-auth-httplib2` - Autenticación HTTP
- `google-auth-oauthlib` - Flujo OAuth

---

## Solución de Problemas

### Email

**Error: "oauth_credentials no configurado"**
- Asegúrate de haber ingresado el Client ID y Client Secret
- Usa el botón "Usar credenciales predeterminadas" si no tienes tus propias credenciales

**No se abre la ventana de autorización**
- Asegúrate de ejecutar el backend en un entorno con acceso a navegador
- Revisa la consola del backend para ver el URL de autorización
- Copia el URL y ábrelo manualmente en tu navegador

**Error: "Token expirado"**
- El sistema refrescará automáticamente el token
- Si persiste, elimina el archivo `backend/data/gmail_token.pickle` y autoriza nuevamente

**No llegan los correos**
- Revisa la carpeta de spam
- Verifica que las direcciones de destinatarios sean correctas
- Usa el botón "Enviar Email de Prueba" para diagnosticar
- Confirma que la cuenta de Google autorizada tenga permisos para enviar correos

### Google Drive

**Error: "Credenciales OAuth no configuradas"**
- Asegúrate de haber configurado las credenciales en el archivo `.env`
- Verifica que `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` estén correctos
- También puedes configurarlas desde la interfaz web en Configuración → Google Drive

**Error: "base_folder_id inválido"**
- Confirma que el ID de carpeta sea correcto
- Verifica que la cuenta autorizada tenga acceso a esa carpeta

**No se abre la ventana de autorización**
- Asegúrate de ejecutar el backend en un entorno con acceso a navegador
- En servidores remotos, copia el URL de autorización y ábrelo localmente

---

## Desactivar Funcionalidades

Para desactivar temporalmente el envío de correos o la subida a Drive:

1. Ve a **Configuración**
2. Desmarca la casilla **"Habilitar envío de correos"** o **"Habilitar subida a Google Drive"**
3. Guarda la configuración

Las ejecuciones continuarán funcionando normalmente, pero sin enviar correos ni subir archivos a Drive.
