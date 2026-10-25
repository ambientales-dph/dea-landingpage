# Plan de Implementación: Pipeline GIS (Google Drive ➔ Firebase Storage ➔ CartoDEA)

Este documento detalla la arquitectura, el flujo de procesamiento y la hoja de ruta paso a paso para sincronizar automáticamente las capas cartográficas de cada proyecto/obra desde **Google Drive** hacia un **Gemelo Digital en Firebase Storage**, permitiendo que **CartoDEA** las consuma de forma rápida y optimizada en su panel de *Capas DEA*.

---

## 1. Arquitectura General y Flujo de Datos

```mermaid
flowchart TD
    subgraph Local_Workstations [Técnicos / Proyectistas]
        A[QGIS / ArcMap] -->|Edita capas sueltas| B[Google Drive Desktop]
    end

    subgraph Google_Drive [Google Drive en la Nube]
        B -->|Sincroniza| C[Carpeta /GIS del Proyecto]
        C --> D1[subcarpeta /shp: .shp, .dbf, .shx, .prj]
        C --> D2[subcarpeta /json: .geojson, .kml]
        C --> D3[subcarpeta /img: .tif, ortofotos]
    end

    subgraph Pipeline_Motor [Motor de Ingesta & Conversión]
        E{Disparador}
        E -->|Opción A: Botón Manual| F[Sincronizar ahora]
        E -->|Opción B: Cron / On-Open| G[Check de modifiedTime]
        
        F & G --> H[Lector de Drive API]
        H --> I[Agrupador de Shapefiles]
        I --> J[Conversor a GeoJSON + Reprojección a WGS84]
    end

    subgraph Firebase_Mirror [Gemelo en Firebase Storage & Firestore]
        J -->|Guarda .geojson optimizado| K[Firebase Storage: /proyectos/{id}/gis/]
        J -->|Registra metadata y bounding box| L[Firestore: coleccion gis_layers]
    end

    subgraph CartoDEA_App [Visor CartoDEA]
        K & L --> M[Panel 'Capas DEA']
        M --> N[Renderizado inmediato en Mapa Web]
    end
```

---

## 2. Decisiones Técnicas Fundamentales

| Componente | Decisión | Justificación |
| :--- | :--- | :--- |
| **Repositorio Fuente** | Google Drive (`/GIS`) | Donde trabajan diariamente los técnicos con Google Drive Desktop y software SIG de escritorio. |
| **Repositorio de Consumo** | Firebase Storage (Gemelo) | Entrega CDN ultrarrápida, sin cuotas restrictivas de la API de Drive y con CORS configurado para CartoDEA. |
| **Estrategia de Sincronización** | **Híbrida (A + B)** | **Opción A:** Botón manual *"Sincronizar GIS"* para ver cambios inmediatamente.<br>**Opción B:** Chequeo automático en background por `modifiedTime` al abrir el proyecto en CartoDEA o mediante tarea programada. |
| **Procesamiento de Shapefiles** | Agrupación por nombre base | El motor toma `.shp` + `.dbf` + `.prj`, lee el CRS original (ej: POSGAR 07 Faja 5 / 6) y lo transforma a EPSG:4326 (WGS84). |
| **Tratamiento de Rásteres** | Almacenamiento directo / COG | Los `.tif` se alojan en Storage y se referencian con metadata geográfica para superposición o descarga. |

---

## 3. Hoja de Ruta de Implementación (Roadmap)

### Fase 1: Entorno y Conectividad Multirraíz
- [x] **1.1.** Habilitar acceso de espacio de trabajo a la carpeta hermana `/cartodea` e inspeccionar dependencias y estructura de repositorio.
- [x] **1.2.** Relevar la estructura actual del visor CartoDEA:
  - Motor de mapas: **OpenLayers (`ol` v9.2.4)** con soporte nativo de capas vectoriales GeoJSON (`ol/source/Vector`, `ol/layer/Vector`, `ol/format/GeoJSON`).
  - Bibliotecas auxiliares ya instaladas en CartoDEA: `shpjs` (v4.0.4), `@turf/turf`, `jszip`, `firebase` (v11.9.1).
  - Componente diana a reemplazar: llamada a GeoServer en `cartodea/src/components/geo-mapper-client.tsx` y hook `useGeoServerLayers.ts`.
- [x] **1.3.** Configurar credenciales y arquitectura de sincronización:
  - `portal_dea` cuenta con credenciales activas de Google Drive API v3 (`google.auth.OAuth2` en `src/services/google-drive.ts`).
  - Los GeoJSONs optimizados se alojarán en Firebase Storage con URLs públicas/tokenizadas para consumo ultrarrápido y sin CORS desde CartoDEA.


### Fase 2: Motor de Ingesta y Conversión Geoespacial (Backend/API)
- [x] **2.1.** Módulo de inspección de carpetas `/GIS` en Google Drive:
  - Búsqueda case-insensitive (`GIS`, `Gis`, `gis`).
  - Detección de subcarpetas permitidas: `/shp`, `/json`, `/geojson`, `/kml`, `/img`, `/dem`.
  - Filtro estricto para ignorar carpetas sin capas cartográficas (`/tabla`, `/tablas`, `/reportes`, `/dwg`, `/lyr`, `/pdf`, `/mapas`).
  - Filtro para ignorar archivos de bloqueo y temporales (`*.lock`, `*.tmp`, `*.xml`, `*.sbn`, `*.sbx`).
  - **100% READ-ONLY sobre Google Drive** (seguridad garantizada para carpetas de trabajo reales).
- [x] **2.2.** Módulo de compilación Shapefile ➔ GeoJSON:
  - Agrupación por nombre base (`.shp`, `.dbf`, `.shx`, `.prj`).
  - Detección y reproyección automática de POSGAR 2007 (Faja 5 y 6) y Campo Inchauspe a EPSG:4326 (WGS84) mediante `proj4`.
  - Auto-detección inteligente por rango de coordenadas si el `.prj` no existe o no tiene proyección explícita (coordenadas `> 5,000,000` detectadas como Faja 5).
- [x] **2.3.** Conversor KML/KMZ ➔ GeoJSON (usando `@tmcw/togeojson`, `@xmldom/xmldom` y descompresión `JSZip` para `.kmz`).
- [x] **2.4.** Cálculo automático de *Bounding Box* (`bbox: [minLon, minLat, maxLon, maxLat]`) para cada capa individual para permitir zoom y encuadre automático en el mapa.

### Fase 3: Almacenamiento del Gemelo Digital (Firebase Storage + Metadatos en Firestore)
- [x] **3.1.** Almacenamiento de archivos GeoJSON en **Firebase Storage**:
  - Destino en bucket: `gis/{projectCode}/{layerId}.geojson`.
  - **Eliminación total del guardado de GeoJSON en Firestore** para prevenir abortos y fallos por la cuota estricta de 1 MB por documento.
  - Caché local auxiliar en `public/gis_cache/{projectCode}/{layerId}.geojson` para desarrollo ágil y fallback offline.
- [x] **3.2.** Catálogo ligero de metadatos en **Firestore** (`projects_gis/{projectCode}/layers/{layerId}`):
  - Nombre (`name`), título legible (`title`), categoría (`category: shp | json | kml | img | dem`).
  - Tipo de geometría (`geometryType`) y conteo de geometrías (`featureCount`).
  - Límites geográficos (`bbox: [minLon, minLat, maxLon, maxLat]`).
  - Proyección original (`sourceProjection`), carpeta origen en Drive (`driveFolderId`) y timestamp (`lastSync`).
  - Referencia al Storage (`storagePath`) y URL de acceso (`downloadUrl`).
- [x] **3.3.** Endpoints REST con soporte CORS (`Access-Control-Allow-Origin: *`):
  - `POST / GET /api/gis/sync`: Disparador de sincronización e ingesta bajo demanda.
  - `GET /api/gis/layers?projectCode=...`: Catálogo de capas agrupadas por categoría (`shp`, `json`, `kml`, etc.).
  - `GET /api/gis/layer?projectCode=...&layerId=...`: Servicio del GeoJSON en WGS84 para carga directa en OpenLayers (desde caché local o Storage).


### Fase 4: Integración en CartoDEA (Visor Cartográfico)
- [x] **4.1.** Reemplazar la llamada al GeoServer desatendido en el panel *"Capas DEA"* (`cartodea/src/components/geo-mapper-client.tsx`).
- [x] **4.2.** Conectar el panel al catálogo de capas DEA (`useGeoServerLayers.ts` / `/api/gis/layers`) para listar dinámicamente el proyecto `RSA063` (38 capas) organizado jerárquicamente por Cuenca y Proyecto.
- [x] **4.3.** Renderizado vectorial nativo en OpenLayers (`handleAddGisVectorLayer` en `useLayerManager.ts`) consumiendo GeoJSONs en WGS84 con reproyección en vivo a EPSG:3857, control de visibilidad/opacidad y encuadre automático por `bbox`.
- [x] **4.4.** Integrar el botón manual *"Sincronizar capas desde Drive"* en cada proyecto del árbol con indicador de giro para actualización forzada bajo demanda.
- [x] **4.5.** Implementar la verificación pasiva (Opción B) al expandir un proyecto con *cooldown* de 15 minutos en memoria para evitar saturación de red.
- [x] **4.6.** Widget flotante de progreso (HUD) en el borde inferior del mapa con streaming en tiempo real (SSE) indicando capa actual, conteo y porcentaje.

### Fase 5: Pruebas y Validación con Proyecto Piloto
- [ ] **5.1.** Prueba de carga de Shapefile en QGIS local y sincronización por Drive Desktop.
- [ ] **5.2.** Validación de fidelidad de coordenadas (que no caiga desplazado por errores de Faja POSGAR).
- [ ] **5.3.** Verificación de rendimiento y tiempos de respuesta en CartoDEA.

---

> [!NOTE]
> Este archivo permanecerá activo en la documentación del proyecto y se irá actualizando a medida que avancemos en cada fase del desarrollo.
