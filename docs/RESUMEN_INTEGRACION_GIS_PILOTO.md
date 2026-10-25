# Resumen Ejecutivo y Guía Integral: Integración GIS (Google Drive ➔ Portal DEA ➔ CartoDEA)

Este documento centraliza todas las decisiones técnicas, criterios de diseño UI/UX, arquitectura de sincronización, reproyecciones cartográficas y especificaciones de despliegue acordadas y desarrolladas para el ecosistema **Portal DEA** y **CartoDEA**. Permite retomar y continuar el trabajo en cualquier máquina sin perder contexto.

---

## 1. Topología del Ecosistema y Entornos

### A. Repositorios y Rutas Locales
- **Portal DEA (Backend API & Gestor):** `e:\dea_dev\portal_dea` (Repo: `ambientales-dph/dea-landingpage`)
- **CartoDEA (Visor Cartográfico SIG):** `e:\dea_dev\cartodea` (Repo: `ambientales-dph/cartoDEA`)
- **DEA Data Bus (Bus de datos):** `e:\dea_dev\dea_data_bus` (Repo: `ambientales-dph/dea-data-bus`)

### B. Puertos y Dominios
| Servicio | Entorno Local | Entorno Producción (Firebase App Hosting) |
| :--- | :---: | :--- |
| **Portal DEA** | `http://localhost:9003` | `https://studio--studio-1428739321-e57bb.us-central1.hosted.app` |
| **CartoDEA** | `http://localhost:9002` | `https://studio--studio-6665536283-f3ea6.us-central1.hosted.app` |

### C. Fuentes de Datos y Almacenamiento
- **Google Drive (Raíz de Cuencas):** ID `1H0f7lTJFCVMD1jiIkcOqxI1L2HC14weD`
- **Firebase Project ID:** `studio-1428739321-e57bb`
- **Firebase Storage Bucket (Gemelo Digital):** `studio-1428739321-e57bb.firebasestorage.app`
- **Firestore DB:** Catálogo de metadatos en colecciones `projects_gis/{projectCode}/layers/{layerId}`.

---

## 2. Proyectos Estandarizados y Nombres Formales

El sistema resuelve automáticamente tanto por código de obra/proyecto como por su denominación formal:

| Código | Cuenca | Nombre Formal de la Obra | ID Carpeta Drive |
| :---: | :--- | :--- | :--- |
| **RSA060** | Río Salado | Desagües Pluviales en Carhué | `1vE3s45E1c3s0035029a1w070g1q6m1q2` |
| **RSA062** | Río Salado | Desagües Pluviales en Cnel. Suárez | `1x_e6w0p1q2r3s4t5u6v7w8x9y0z1a2b` |
| **RSA063** | Río Salado | Saneamiento Loteo Chacra 196 (Gral. La Madrid) | `1Z86iOuXTfnAJDvBV4nhaAg5rkPrTuhcL` |
| **RSA069** | Río Salado | Desagües Pluviales en Llambías | `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p` |
| **MAR013** | Vertiente Río de la Plata | Desagües Pluviales Cuenca Arroyo El Gato | `1q8w7e6r5t4y3u2i1o0p9a8s7d6f5g4h` |

---

## 3. Criterios de Seguridad y Filtrado en Google Drive

1. **Seguridad Absoluta (100% READ-ONLY):**
   - El motor de ingesta **únicamente lee y descarga streams en memoria**.
   - Bajo ninguna circunstancia crea, modifica, renombra ni elimina archivos o carpetas en Google Drive.
2. **Subcarpetas Específicas Procesadas para el SIG:**
   - `/shp`: Shapefiles (`.shp`, `.dbf`, `.shx`, `.prj`). Se compilan como paquetes lógicos agrupando extensiones homónimas.
   - `/json` o `/geojson`: Archivos vectoriales GeoJSON nativos.
   - `/kml` o `/kmz`: Archivos Keyhole Markup Language.
   - `/img`: Imágenes georreferenciadas con worldfiles (`.jgwx`, `.tfwx`).
   - `/dem`: Modelos de elevación digital.
3. **Carpetas Excluidas:**
   - `/tabla`, `/tablas`, `/reportes`, `/dwg` (CAD pesado), `/lyr` (simbología propietaria ESRI), `/pdf`, `/mapas`.
4. **Archivos Auxiliares y Temporales Ignorados:**
   - Bloqueos de software SIG (`*.lock`, `*.tmp`).
   - Índices binarios y metadatos complementarios (`*.sbn`, `*.sbx`, `*.cpg`, `*.xml`).

---

## 4. Motor Geoespacial y Reproyecciones

1. **Detección Automática de Proyección (`proj4`):**
   - Si existe archivo `.prj`, se parsea la definición WKT.
   - Si no existe `.prj` pero las coordenadas están en metros (`X > 5,000,000`), el motor detecta automáticamente **POSGAR / Campo Inchauspe Faja 5 o 6** (Buenos Aires) y lo reproyecta a **WGS84 (EPSG:4326)**.
2. **Separación de Almacenamiento (Storage vs. Firestore):**
   - **GeoJSONs:** Se guardan exclusivamente en Firebase Storage (`gis/{projectCode}/{layerId}.geojson`). **Nunca en Firestore**, evitando el límite estricto de 1 MB por documento.
   - **Firestore:** Almacena únicamente metadatos ultraligeros (~1 KB por capa): `id`, `name`, `title`, `category`, `geometryType`, `featureCount`, `bbox` `[minLon, minLat, maxLon, maxLat]`, `sourceProjection`, `storagePath` y `downloadUrl`.

---

## 5. Criterios de Interfaz de Usuario (UI/UX en CartoDEA)

### A. Estado Inicial del Árbol de Capas (`LegendPanel.tsx`)
- **100% Colapsado:** Al cargar el visor, todo el árbol de capas inicia completamente cerrado (cuencas, proyectos y subcarpetas).
- **Auto-expansión Inteligente:** Si el usuario escribe en el cuadro de búsqueda, el árbol expande automáticamente solo las ramas y carpetas que contienen coincidencias.

### B. Estética y Controles
- **Encabezado de Cuenca:** Texto limpio con contador `[+] / [−] Cuenca (N)`, sin ícono de capas redundante.
- **Ícono de Capas:** Ícono `Layers` con fondo transparente y sin bordes (`bg-transparent border-0 text-sky-400`). Al activar la capa en el mapa, conmuta a un `Check` verde sutil.
- **Tooltips Radix UI:** Al posarse sobre el código del proyecto (`RSA060`, `RSA063`, etc.), se despliega un tooltip oscuro estilizado que muestra el código y el nombre formal de la obra. Se eliminó el atributo HTML `title` para erradicar la superposición con el tooltip nativo blanco del navegador.
- **Buscador Insensible a Acentos y Multi-token:** Implementado con normalización diacrítica:
  ```ts
  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  ```
  Permite buscar términos como *"suarez"*, *"carhue"* o *"llambias"* sin importar si el usuario tipea con o sin tilde.

---

## 6. Arquitectura de Sincronización (Híbrida: Pasiva + Manual + HUD)

Para evitar saturar cuotas de la API de Google Drive y garantizar máxima velocidad al usuario:

```
                  ┌──────────────────────────────────────────────┐
                  │          Usuario en CartoDEA                 │
                  └──────────────┬───────────────────────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            ▼                                         ▼
   [Expande Proyecto]                        [Clic Botón Sync Manual]
            │                                         │
    ¿En cooldown < 15 min?                            │
      ├── SÍ ──> No hace nada                         │
      └── NO ──> Consulta /api/gis/check-update       │
                     │                                │
             ¿Hubo cambios en Drive?                  │
               ├── NO ──> Actualiza timestamp         │
               └── SÍ ──> Dispara SSE Stream <────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │    /api/gis/sync-stream       │
               │ (Server-Sent Events en vivo)  │
               └──────────────┬────────────────┘
                              │
                              ▼
               ┌───────────────────────────────┐
               │     SyncProgressHUD (Mapa)    │
               │ Barra progresiva glassmorphism│
               │   "Procesando capa 3 de 12"   │
               └───────────────────────────────┘
```

1. **Sincronización Pasiva (en 2do plano):**
   - Se activa únicamente al expandir un proyecto.
   - **Cooldown de 15 minutos en memoria** por proyecto (`lastCheckedProjectsRef`).
   - Endpoint `/api/gis/check-update?projectCode=...`: Compara en ~120 ms el `modifiedTime` de la carpeta de Drive contra el `lastSync` de Firestore sin descargar archivos.
2. **Sincronización Manual:**
   - Botón de refresco (`RefreshCw`) junto a cada proyecto que omite el cooldown.
3. **HUD Progresivo Flotante en el Mapa (`SyncProgressHUD.tsx`):**
   - Al sincronizar, aparece una barra flotante de diseño glassmorphism en el borde inferior del mapa.
   - Muestra spinner animado, código del proyecto, nombre de la capa en proceso, contador progresivo `X / Total` y barra porcentual.
   - Se auto-cierra 3.5 segundos tras finalizar exitosamente o permite cierre manual con botón `×`.

---

## 7. Endpoints de la API GIS (Portal DEA)

Todos los endpoints incluyen cabeceras CORS (`Access-Control-Allow-Origin: *`) para consumo directo desde CartoDEA:

| Endpoint | Método | Parámetros | Función |
| :--- | :---: | :--- | :--- |
| `/api/gis/layers` | `GET` | `projectCode` *(opcional)* | Si se omite o es `ALL`, devuelve el catálogo general multi-cuenca completo. Si se especifica, filtra por ese proyecto. |
| `/api/gis/layer` | `GET` | `projectCode`, `layerId` | Descarga el GeoJSON optimizado en WGS84 (desde disco local o streaming desde Firebase Storage). |
| `/api/gis/check-update` | `GET` | `projectCode` | Chequeo ultrarrápido de cambios en Drive comparando `modifiedTime` vs `lastSync`. |
| `/api/gis/sync-stream` | `GET` | `projectCode`, `folderId` *(opcional)* | Sincronización con emisión de eventos en tiempo real mediante **Server-Sent Events (SSE)**. |
| `/api/gis/sync` | `GET/POST` | `projectCode`, `folderId` | Sincronización por lote clásica (devuelve JSON final). |

---

## 8. Criterios de Despliegue en Firebase App Hosting (Producción)

### A. Autenticación Resiliente de Firebase Admin (`src/firebase/admin.ts`)
- **Problema Detectado en Producción:**  
  1. Los archivos `.json` de credenciales locales están en `.gitignore` y no se suben a GitHub.
  2. La cuenta por defecto de Cloud Run (`firebase-app-hosting-compute`) carece de rol `roles/datastore.user` asignado por defecto en Google Cloud IAM, produciendo el error:  
     `7 PERMISSION_DENIED: Missing or insufficient permissions`.
  3. Variables de entorno globales como `GOOGLE_SERVICE_ACCOUNT_EMAIL` pueden pertenecer a otros proyectos (como la Línea de Tiempo en proyecto `39519`).
- **Solución Implementada:**  
  Se crearon módulos exclusivos de backend:
  - [src/firebase/portal-credentials.ts](file:///e:/dea_dev/portal_dea/src/firebase/portal-credentials.ts): Aloja las credenciales certificadas de la cuenta de servicio administrativa `firebase-adminsdk-fbsvc@studio-1428739321-e57bb.iam.gserviceaccount.com`.
  - [src/firebase/admin.ts](file:///e:/dea_dev/portal_dea/src/firebase/admin.ts): Inicializa `firebase-admin` garantizando acceso irrestricto tanto en local como en Cloud Run a Firestore y Cloud Storage.

### B. Salto Seguro entre Portal DEA y CartoDEA
- En [portal_dea/src/app/page.tsx](file:///e:/dea_dev/portal_dea/src/app/page.tsx), el salto seguro a CartoDEA se realiza mediante un formulario POST dinámico inyectando `firebase_token` y `uid` hacia:  
  `https://studio--studio-6665536283-f3ea6.us-central1.hosted.app/api/auth/portal-sync`.

---

## 9. Compromisos Operativos para Pruebas
- **Validación Visual de UI y Consola:** Siempre solicitada al usuario para probar directamente en el navegador activo, garantizando agilidad y evitando la ejecución de subagentes de navegación autónomos innecesarios.
- **Integridad de Código:** Cualquier modificación debe mantener los docstrings existentes y verificarse con `next build` antes de realizar push a `main`.
