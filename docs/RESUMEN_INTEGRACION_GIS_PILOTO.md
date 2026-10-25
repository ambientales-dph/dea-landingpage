# Resumen Ejecutivo: Integración GIS (Google Drive ➔ Portal DEA ➔ CartoDEA)

Este documento resume las decisiones técnicas, criterios de filtrado, arquitectura implementada y resultados del proyecto piloto para continuar el desarrollo en cualquier dispositivo sin perder contexto.

---

## 1. Datos del Proyecto Piloto
- **Proyecto:** `RSA063 - Saneamiento Loteo Chacra 196`
- **ID de Carpeta Google Drive:** `1Z86iOuXTfnAJDvBV4nhaAg5rkPrTuhcL`
- **Municipio:** General La Madrid, Provincia de Buenos Aires
- **Coordenadas Reales Obtenidas:** Longitud ~ `-61.26°`, Latitud ~ `-37.24°` (WGS84)

---

## 2. Criterios de Seguridad y Filtrado Acordados

1. **Seguridad Absoluta (100% READ-ONLY en Drive):**
   - El motor de ingesta **únicamente lee y descarga buffers en memoria**.
   - No se crea, modifica, renombra ni borra ningún archivo ni carpeta en Google Drive.
2. **Subcarpetas Permitidas (para el panel cartográfico):**
   - `/shp`: Shapefiles sueltos (`.shp`, `.dbf`, `.shx`, `.prj`).
   - `/json` o `/geojson`: Archivos vectoriales GeoJSON.
   - `/kml`: Archivos KML o KMZ.
   - `/img`: Imágenes y ortofotos georreferenciadas con worldfiles (`.jgwx`, `.tfwx`).
   - `/dem`: Modelos de elevación digital.
3. **Carpetas Ignoradas Exclusivamente:**
   - `/tabla` o `/tablas`: Archivos Excel/Word administrativos.
   - `/reportes`: Documentación técnica.
   - `/dwg`: Archivos CAD no georreferenciados o muy pesados.
   - `/lyr`: Archivos de simbología propietaria de ESRI.
   - `/pdf` y `/mapas`: Salidas gráficas estáticas.
4. **Archivos Temporales y Auxiliares Ignorados:**
   - Filtro para ignorar bloqueos de software SIG (`*.lock`, `*.tmp`).
   - Filtro para no tratar como capas independientes a los índices (`*.sbn`, `*.sbx`, `*.cpg`, `*.xml`).

---

## 3. Arquitectura del Motor Geoespacial

### A. Reproyección Cartográfica (`proj4`)
En la Provincia de Buenos Aires, los Shapefiles suelen trabajarse en:
- **POSGAR 2007 Faja 5 (EPSG:5347)** y **Faja 6 (EPSG:5348)**
- **Campo Inchauspe Faja 5 (EPSG:22185)** y **Faja 6 (EPSG:22186)**
- **WGS84 (EPSG:4326)**

**Mecanismo inteligente implementado:**
- Si el archivo `.prj` existe, se detecta la proyección exacta.
- Si el archivo `.prj` no existe o no tiene proyección explícita pero sus coordenadas están en metros (`X > 5,000,000`), el motor detecta automáticamente que pertenece a **Faja 5** y lo transforma a EPSG:4326 (WGS84).

### B. Destino en la Nube: Firebase Storage (Capas) + Firestore (Solo Catálogo)
Para evitar la limitación estricta de **1 MB por documento de Firestore** (capas como `rsa063_suelos_la_madrid` pesan 1.4 MB y redes de infraestructura superan los 600 KB):
1. **Destino de Archivos GeoJSON (Firebase Storage):**
   - Las capas GeoJSON completas **se almacenan directamente en Firebase Storage** bajo la ruta `gis/{projectCode}/{layerId}.geojson`.
   - **En ningún caso se guardan GeoJSONs dentro de Firestore**, eliminando de raíz el riesgo de abortar la transformación o el guardado por temas de tamaño de archivo.
   - En entorno de desarrollo local, adicionalmente se almacena una copia en caché estática en `public/gis_cache/{projectCode}/{layerId}.geojson`.
2. **Catálogo de Metadatos en Firestore:**
   - La colección `projects_gis/{projectCode}/layers/{layerId}` funciona exclusivamente como un **catálogo ligero de metadatos** (pesa ~1 KB por registro):
   - `id`, `name`, `title`, `category` (`shp` | `json` | `kml` | `img` | `dem`).
   - `geometryType` (Point, LineString, Polygon, MultiPolygon).
   - `featureCount` (cantidad de geometrías).
   - `bbox` (`[minLon, minLat, maxLon, maxLat]`) para zoom automático en el mapa.
   - `sourceProjection`, `driveFolderId`, `lastModifiedDrive` y `lastSync`.
   - `storagePath` (ruta del objeto en Firebase Storage).
   - `downloadUrl` (enlace directo o proxy al archivo GeoJSON).

---

## 4. Endpoints API Disponibles (Con soporte CORS)

Todos los endpoints incorporan la cabecera `Access-Control-Allow-Origin: *` para ser consumidos directamente desde **CartoDEA** (puerto 9002 o producción) o desde **Portal DEA** (puerto 9003 o producción):

| Endpoint | Método | Descripción |
| :--- | :---: | :--- |
| `/api/gis/sync` | `GET / POST` | Dispara el escaneo y compilación de capas de un proyecto desde Drive (`?projectCode=RSA063&folderId=...`). |
| `/api/gis/layers` | `GET` | Devuelve el catálogo completo de capas del proyecto agrupadas por categoría (`shp`, `json`, `kml`, etc.). |
| `/api/gis/layer` | `GET` | Descarga/sirve directamente el archivo GeoJSON estandarizado en WGS84 (`?projectCode=RSA063&layerId=...`). |

---

## 5. Resultados del Test en el Piloto (RSA063)
- **38 capas compiladas y catalogadas con éxito**, incluyendo:
  - Red de agua ABSA (532 líneas)
  - Red de cloacas ABSA (542 líneas)
  - Red de gas (458 líneas)
  - Suelos General La Madrid (62 polígonos - 1.38 MB)
  - Recorrido histórico de estaciones (43 puntos)
  - Salud y Educación (equipamientos urbanos)
  - Trazas, áreas de influencia (AID, AII, AO)
  - Caminos rurales, calles y red hidrográfica

---

## 6. Próximo Paso: Fase 4 (Integración en CartoDEA)
1. Abrir `cartodea/src/components/geo-mapper-client.tsx` y su panel de capas.
2. Reemplazar la llamada obsoleta de GeoServer (`useGeoServerLayers.ts`) por una llamada a `http://localhost:9003/api/gis/layers?projectCode={currentProject}` (o variable de entorno en prod).
3. Renderizar las capas en OpenLayers usando `ol/source/Vector` con `format: new GeoJSON()` apuntando al endpoint `/api/gis/layer`.
4. Conectar el encendido/apagado de capas, selector de opacidad y botón de *"Zoom a la capa"* usando el `bbox` almacenado.
