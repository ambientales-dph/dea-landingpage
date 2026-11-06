# Plan de Migración de Trello a Firestore (`portal_dea`)

**Última actualización:** 05/11/2026  
**Estado general:** ✅ Fases 1 y 2 completadas — En Etapa de Revisión Manual (Fase 3)

---

## 1. Objetivo y Estrategia de Transición Segura

El objetivo es migrar la totalidad de la información de proyectos, obras, comentarios, adjuntos y tarjetas complementarias desde los dos tableros de Trello (**`PROYECTOS DEAS`** y **`SEGUIMIENTO DE OBRAS`**) hacia **Cloud Firestore** y **Firebase Storage**, de modo que:

1. **Toda lectura y escritura del Portal y de la Línea de Tiempo pase a realizarse exclusivamente en Firestore** (cesando las escrituras en Trello ante ediciones de ficha, cambios de estado, comentarios o nuevos proyectos).
2. **Se mantenga activo el enlace de consulta a la tarjeta original de Trello (`url` / botón "Ver en Trello")** en cada proyecto y en cada ítem de Misceláneas durante el período de revisión manual.
3. **Trello quede en modo "congelado / referencia histórica"** hasta que se valide manualmente toda la información y se decida desconectar definitivamente el vínculo.

---

## 2. Resumen de Números Reales Migrados

| Métrica | Cantidad | Detalle |
| :--- | :---: | :--- |
| **Tableros migrados (`project_boards`)** | **2** | `PROYECTOS DEAS` (`5ffc801cf3f43446ad22e1b0`) y `SEGUIMIENTO DE OBRAS` (`6182b5b73b68da8f804d5d82`) |
| **Proyectos migrados (`projects`)** | **185** | 181 con código estándar + 4 normalizados (`RRQ020`, `QQG001`, `RSA006` Seguimiento, `MAR003` Pluvial) |
| **Tarjetas descartadas (vacías/plantilla)** | **3** | `Nombre del proyecto (XXX000)`, `RSA101` (archivada vacía) y `Qpeot (MAR011)` (archivada vacía) |
| **Tarjetas en `Misceláneas` (`miscellaneous_cards`)** | **11** (originalmente 22) | Tarjetas temáticas y de referencia general sin código de proyecto (se depuraron las 4 de Metodología, Kobo, Informes semestrales, los 3 duplicados de Recursos Internos y las 2 de Manual Salvaguardas y ROP ya en Documentación de Referencia) |
| **Archivos en `Documentación de Referencia`** | **2** (originalmente 9) | Los 6 modelos/manuales (Manual Salvaguardas PDF+DOCX, 2 Modelos Informes PGAS, 2 Modelos Reuniones) se mudaron a Recursos Internos como recursos institucionales con metadatos completos |
| **Adjuntos binarios de proyectos subidos a Storage** | **7** | Correspondientes a `RSA070`, `MAR008`, `MAR007` y `RPS006` (`project_attachments/`) |
| **Comentarios migrados** | **143** | Incluidos en el historial de actividad de cada proyecto |
| **Peso total en Firestore** | **~772 KB** | < 0.08% de 1 GB (Costo de almacenamiento y lecturas/escrituras: **$0.00 / mes**) |

---

## 3. Fases del Plan de Trabajo

### Fase 1: Migración de Datos a Firestore y Storage (Sin desconectar enlaces a Trello) — ✅ COMPLETADA
- [x] **1.1. Colección `projects` en Firestore**:
  - Migrados los **185 proyectos** conservando su `id` original de Trello como `docId` (para mantener intactos los vínculos con `timeline_projects/{cardId}`, alertas ambientales y `app_activities`).
  - Almacenados tanto los **campos estructurados limpios** (`fields`) como la **`desc` (descripción técnica completa)**, `labels`, `cover`, `attachments`, `actions` (comentarios/movimientos) y el **`url` / `trelloUrl` original**.
- [x] **1.2. Rescate de los 15 archivos físicos alojados en los servidores de Trello (8.75 MB)**:
  - Descargados de Trello y subidos a **Firebase Storage**:
    - **8 archivos** de las 5 tarjetas de referencia/plantillas subidos a `reference_docs/` y registrados en `reference_documents`.
    - **7 archivos** adjuntos a proyectos específicos (`MAR007`, `MAR008`, `RSA070`, `RPS006`) subidos a `project_attachments/{code}/` y vinculados a sus fichas.
- [x] **1.3. Normalización de proyectos con nomenclatura no estándar**:
  - Normalizados los nombres de `RRQ020`, `QQG001`, `RSA006` (Seguimiento) y `MAR003` (Pluvial) al formato estándar `Nombre de Obra (XXX000)`.
- [x] **1.4. Sección `Misceláneas` en Biblioteca de Recursos**:
  - Creada la colección `miscellaneous_cards` en Firestore con las **22 tarjetas no-proyecto** y habilitada la sección desplegable **Misceláneas** en [`src/components/resource-library.tsx`](file:///e:/dea_dev/portal_dea/src/components/resource-library.tsx) con buscador propio, acceso a carpetas de Drive y botón directo **"Trello"** (`url`).

---

### Fase 2: Cambio de Arquitectura de Lectura y Escritura a Firestore (Modo Revisión) — ✅ COMPLETADA
- [x] **2.1. Lectura de proyectos desde Firestore**:
  - Actualizado [`src/services/trello.ts`](file:///e:/dea_dev/portal_dea/src/services/trello.ts) para que `getAllCardsFromAllBoards()`, `getCardById()`, `getTrelloBoards()`, `getListsOnBoard()`, `getBoardLabels()` y `getCardActivity()` lean directamente de las colecciones `projects` y `project_boards` en Firestore.
- [x] **2.2. Escritura 100% en Firestore (Cese total de escritura en Trello)**:
  - Actualizadas todas las funciones de mutación (`createTrelloCard`, `updateTrelloCard`, `addCommentToCard`, `addAttachmentToTrelloCard`, `removeAttachmentFromTrelloCard`, `addLabelToCard`, `removeLabelFromCard`) en [`src/services/trello.ts`](file:///e:/dea_dev/portal_dea/src/services/trello.ts) para que impacten únicamente en Firestore.
  - Se mantiene visible el botón **"Ver en Trello"** (`selectedCard.url`) en [`src/components/card-search.tsx`](file:///e:/dea_dev/portal_dea/src/components/card-search.tsx#L865-L867) para revisión manual.
- [x] **2.3. Integración con Línea de Tiempo (`/timeline`)**:
  - Actualizado [`src/timeline/services/trello.ts`](file:///e:/dea_dev/portal_dea/src/timeline/services/trello.ts) para que la búsqueda, listado por tablero/cuenca y edición de equipo nominado operen 100% sobre Firestore sin escribir en Trello.
- [x] **2.4. Campana de Notificaciones**:
  - Conectada a la actividad registrada en Firestore (`app_activities` y acciones recientes en `projects`).

---

### Fase 3: Revisión Manual y Desconexión Definitiva de Trello (En curso — A espera de indicación)
- [ ] **3.1. Revisión manual**: Verificar desde el Portal y la Biblioteca de Recursos las fichas de proyectos, Documentación de Referencia y Misceláneas usando los accesos vigentes a Trello.
- [ ] **3.2. Reubicación progresiva de `Misceláneas`**: Organizar definitivamente las tarjetas temporales de la sección Misceláneas.
- [ ] **3.3. Corte definitivo (cuando lo indiques)**: Ocultar los botones de enlace externo a Trello y retirar las variables `TRELLO_API_KEY` / `TRELLO_API_TOKEN`.

---

## 4. Decisiones Confirmadas y Aplicadas

### A. Proyectos con código fuera del formato estándar
1. **`D P en Cuenca Vergara (Villa Tesei-Hurlingam)- RRQ020`** (`PROYECTOS DEAS` → `Cuenca Río Reconquista`)  
   ✅ Migrado normalizado como: `D P en Cuenca Vergara (Villa Tesei-Hurlingam) (RRQ020)`.
2. **`Desagües pluviales en el sector sur de la localidad de Coronel Pringles (QQG001).`** (`PROYECTOS DEAS` → `Cuenca Quequén Grande`)  
   ✅ Migrado normalizado como: `Desagües pluviales en el sector sur de la localidad de Coronel Pringles (QQG001)`.
3. **`TERRAPLÉN DE DEFENSA DE LA LOCALIDAD DE PEHUAJÓ (ALTEO Y CONFORMACIÓN SECTOR NOROESTE - RSA006)`** (`SEGUIMIENTO DE OBRAS`)  
   ✅ Mantenido como ficha independiente de su par en `PROYECTOS DEAS`, normalizado a: `TERRAPLÉN DE DEFENSA DE LA LOCALIDAD DE PEHUAJÓ (ALTEO Y CONFORMACIÓN SECTOR NOROESTE) (RSA006)`.
4. **`Desagües Pluviales en Máximo Paz y Puentes en calle Combate de Los Pozos y Suiza sobre arroyo Cañuelas (PLUVIAL MAR003)`** (`SEGUIMIENTO DE OBRAS`)  
   ✅ Mantenido como ficha independiente de `... (OBRA PUENTES) (MAR003)`, normalizado a: `Desagües Pluviales en Máximo Paz y Puentes en calle Combate de Los Pozos y Suiza sobre arroyo Cañuelas (PLUVIAL) (MAR003)`.

### B. Tarjetas vacías o de plantilla descartadas de `projects`
- ✅ Descartadas de `projects`: `Nombre del proyecto (XXX000)`, `RSA101` (archivada vacía) y `Qpeot (MAR011)` (archivada vacía).

### C. Distribución entre `Documentación de Referencia` y `Misceláneas`
- ✅ **En `Documentación de Referencia` (`reference_documents` + Firebase Storage):**
  1. `IF-2023-35114183-GDEBA-DFYEPMHYFGP.pdf` — *Reglamento Operativo del Programa (“ROP”)*
  2. `Manual de Procedimientos Salvaguardas VF (2) (1).pdf` — *MANUAL DE PROCEDIMIENTOS SALVAGUARDAS VF*
  3. `Manual de Procedimientos Salvaguardas VF (2).docx` — *MANUAL DE PROCEDIMIENTOS SALVAGUARDAS VF*
  4. `Modelo Matrices.xlsx` — *Matriz de Impactos y cálculo de VIA (modelo)*
  5. `informe vista MODELO.docx` — *Informes (PLANILLAS Y ACTAS)*
  6. `Informe Mensual de Ejecución del PGAS a ser presentado por Contratista.docx` — *Informes (PLANILLAS Y ACTAS)*
  7. `Solicitud de reunión.docx` — *Reuniones (SEGUIMIENTO DE OBRAS)*
  8. `Acta de reunión.docx` — *Reuniones (SEGUIMIENTO DE OBRAS)*
- ✅ **En `Misceláneas` (`miscellaneous_cards` en Biblioteca de Recursos):**
  Las **22 tarjetas no-proyecto** completas (incluyendo las 3 tarjetas de cuencas sin código), con buscador propio, acceso directo a sus carpetas de Google Drive / links Kobo y el botón **"Trello"** que abre la tarjeta original.
