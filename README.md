# Orquestador de Reportes BBDD

Aplicación para gestionar y ejecutar queries de bases de datos de forma centralizada. Permite registrar queries SQL, asociarlas a bases de datos configurables, ejecutarlas individualmente o en lote con credenciales bajo demanda, y descargar los resultados en Excel.

## Características

- **Queries como adjuntos**: Registra queries subiendo archivos `.sql` o pegando el contenido.
- **Bases de datos configurables**: Soporta PostgreSQL y SQL Server; conexiones editables y prueba de conexión.
- **Autenticación flexible**: Soporta autenticación SQL (usuario/contraseña) y autenticación de Windows para SQL Server.
- **Ejecución individual o en lote**: Selecciona una o varias queries y ejecútalas a la vez.
- **Credenciales bajo demanda**: Al ejecutar, se piden credenciales solo para las bases involucradas que usan autenticación SQL; opción de usar las mismas para todas o distintas por base.
- **Ejecución en background**: Las queries se ejecutan en segundo plano con seguimiento de progreso en tiempo real.
- **Descarga de resultados**: Cada query genera un archivo Excel (.xlsx) descargable desde el historial de ejecuciones.
- **Importación desde carpeta**: Importa en bloque las queries de la carpeta `querys/` del proyecto.
- **Notificaciones por email**: Envía correos automáticos al inicio y fin de cada ejecución con variables personalizables.
- **Subida automática a Google Drive**: Organiza los resultados en Drive con estructura de carpetas por mes/fecha/query.

## Requisitos

- **Python 3.10+** (backend) - Se recomienda Python 3.13 para mejor compatibilidad
- **Node.js 18+** y npm (frontend)
- Acceso a las redes donde están las bases de datos (según `correo.txt`)
- **Opcional**: `pyodbc` y driver ODBC de SQL Server (solo para autenticación de Windows) - Ver [WINDOWS_AUTH.md](WINDOWS_AUTH.md)

## Estructura del proyecto

```
OrquestadorReportesBBDD/
├── backend/              # API FastAPI
│   ├── main.py           # Endpoints y arranque
│   ├── models.py         # Modelos Pydantic
│   ├── database_connector.py   # Conexiones PostgreSQL / SQL Server
│   ├── executor.py       # Ejecución de queries en background
│   ├── requirements.txt
│   └── data/             # Creado al ejecutar: bases, queries, ejecuciones, resultados
├── frontend/             # SPA React + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── services/
│   │   ├── types/
│   │   └── lib/
│   ├── package.json
│   └── ...
├── querys/               # Archivos SQL originales (referencia / importación)
├── correo.txt            # Información de bases de datos (referencia)
├── start.bat             # Inicia backend + frontend (Windows)
├── stop.bat              # Detiene backend + frontend (Windows)
└── README.md
```

## Instalación

### Backend

```bash
cd backend
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

(Si usas pnpm: `pnpm install`.)

---

## Ejecutar en otra PC (a partir del ZIP)

1. **Descomprimir** el ZIP en la carpeta deseada (ej. `C:\apps\OrquestadorReportesBBDD`).
2. **Qué no llevar en el ZIP** (en la otra PC se instala de nuevo):  
   `frontend/node_modules`, entornos virtuales de Python (`venv`, `.venv`).  
   Opcional: no incluir `backend/data` (se crea al arrancar).
3. **Requisitos en la otra PC:**
   - **Python 3.10+** ([python.org](https://www.python.org/downloads/)).
   - **Node.js 18+** ([nodejs.org](https://nodejs.org)); trae `npm`. Opcional: [pnpm](https://pnpm.io).
4. **Instalar y arrancar:**
   - Abrir una terminal en la raíz del proyecto.
   - Backend: `cd backend` → `pip install -r requirements.txt`.
   - Frontend: `cd frontend` → `npm install` (o `pnpm install`).
   - Desde la raíz: doble clic en `start.bat` (o arrancar manualmente como en *Uso*).
5. Abrir el navegador en **http://localhost:5174**.

## Uso

### Arrancar la aplicación

**Opción 1 – Script (Windows)**  
Doble clic en `start.bat` o desde la raíz del proyecto:

```bash
start.bat
```

**Opción 2 – Manual**

Terminal 1 (backend):

```bash
cd backend
python main.py
```

Terminal 2 (frontend):

```bash
cd frontend
npm run dev
```

- **Frontend**: http://localhost:5174  
- **Backend API**: http://localhost:8001  

Para detener (Windows): ejecutar `stop.bat` o cerrar las ventanas de los procesos.

### Flujo típico

1. **Bases de datos**: En la pestaña "Bases de Datos" revisa o edita las conexiones (por defecto se crean Alloy y SQL Server según `correo.txt`). Selecciona el tipo de autenticación (SQL o Windows) para cada base. Usa "Probar" para validar la conexión.
2. **Queries**: En "Queries" usa "Importar" para cargar las de la carpeta `querys/`, o "Agregar Query" para subir/pegar SQL y asociar una base de datos.
3. **Configuración** (opcional): En "Configuración" activa y configura el envío de correos electrónicos y/o la subida automática a Google Drive. Ver [EMAIL_DRIVE_CONFIG.md](EMAIL_DRIVE_CONFIG.md) para instrucciones detalladas.
4. **Ejecutar**: Marca las queries deseadas (o una sola) y pulsa "Ejecutar". Introduce las credenciales cuando se pida para bases con autenticación SQL (mismas para todas las bases o distintas por base). Las bases con autenticación de Windows no requieren credenciales.
5. **Resultados**: En "Ejecuciones" verás el progreso y, al terminar, el enlace para descargar cada Excel generado. Si configuraste email o Drive, también recibirás notificaciones y/o los archivos se subirán automáticamente.

## API (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servidor |
| GET/POST | `/api/databases` | Listar / crear base de datos |
| PUT/DELETE | `/api/databases/{id}` | Actualizar / eliminar base de datos |
| POST | `/api/databases/{id}/test` | Probar conexión con credenciales |
| GET/POST | `/api/queries` | Listar / crear query (multipart para archivo SQL) |
| PUT/DELETE | `/api/queries/{id}` | Actualizar / eliminar query |
| GET | `/api/queries/{id}/content` | Contenido SQL de la query |
| POST | `/api/queries/import-folder` | Importar queries desde `querys/` |
| GET/POST | `/api/executions` | Listar ejecuciones / iniciar una nueva |
| GET | `/api/executions/{id}` | Detalle y estado de una ejecución |
| GET | `/api/executions/{id}/download/{filename}` | Descargar archivo Excel de resultado |
| GET/PUT | `/api/config/email` | Obtener / actualizar configuración de email |
| POST | `/api/config/email/test` | Probar configuración de email |
| GET/PUT | `/api/config/drive` | Obtener / actualizar configuración de Drive |

## Tecnologías

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React  
- **Backend**: FastAPI, Pydantic, psycopg2 (PostgreSQL), pymssql (SQL Server), pandas, openpyxl  

Diseño y UX alineados con la aplicación de referencia VisorSN (misma paleta, tipografía y patrones de interfaz).

---

Orquestador de Reportes BBDD · 2025
