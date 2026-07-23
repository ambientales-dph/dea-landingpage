# Informe de Sistema de Información Institucional
**Departamento de Estudios Ambientales (DEA)**
**Versión:** 1.2 - 2026
**Tono:** Corporativo / Técnico

---

## 1. Objetivos del Sistema
El Portal DEA ha sido diseñado como una solución integral para centralizar, estandarizar y auditar la gestión de proyectos y obras del Departamento. Sus objetivos principales son:

*   **Centralización Operativa:** Unificar el acceso a fichas técnicas, documentación y cartografía que anteriormente se encontraba dispersa.
*   **Trazabilidad Histórica:** Garantizar que cada intervención, cambio de estado o documento adjunto posea un registro inalterable de fecha y autoría.
*   **Eficiencia Administrativa:** Automatizar la creación de estructuras de archivos y la asignación de códigos correlativos para evitar errores humanos.
*   **Monitoreo en Tiempo Real:** Proveer herramientas de alerta temprana para comunicaciones externas vinculadas a obras específicas.

## 2. Necesidades Institucionales Atendidas
El sistema responde a carencias críticas detectadas en el flujo de trabajo previo:
1.  **Falta de Nomenclatura Única:** El portal implementa un motor de codificación automática por cuenca, asegurando la unicidad de cada proyecto.
2.  **Fragmentación de Documentos:** Se establece una jerarquía clara entre "Archivos de Trabajo" (servidor técnico) y "Documentación Final" (archivo institucional).
3.  **Dificultad en el Relevamiento:** Se integra un motor de geolocalización que permite situar cada intervención en el mapa provincial de forma inmediata.

## 3. Flujo de Trabajo (Workflow)

El flujo operativo dentro de la plataforma se divide en cuatro fases principales:

### Fase A: Alta y Configuración
*   El usuario ingresa un nuevo proyecto seleccionando la cuenca correspondiente.
*   El sistema genera el **Código Correlativo** y crea automáticamente la **Ficha Técnica Maestra**.
*   Se provisiona de forma automática un **Contenedor Documental** en el repositorio en la nube, otorgando permisos de edición solo a los responsables designados.

### Fase B: Gestión Técnica y Seguimiento
*   Los proyectistas actualizan los campos técnicos (partido, presupuesto, financiamiento, equipo).
*   Cada cambio de estado (ej: de "Iniciado" a "Neutralizado") dispara una notificación automática al sistema de auditoría y genera un hito en la línea de tiempo.
*   Se vinculan recursos bibliográficos externos y repositorios científicos a la ficha del proyecto.

### Fase C: Registro Cronológico (Timeline)
*   Se registran eventos relevantes (visitas de obra, informes de impacto, reuniones).
*   El sistema clasifica los archivos adjuntos según su naturaleza, moviéndolos a carpetas protegidas si se consideran "Entregables Finales".
*   Se permite la exportación de hitos entre proyectos relacionados para agilizar la carga de información transversal.

### Fase D: Supervisión y Reporte
*   **Radar de Novedades:** El sistema monitorea canales de comunicación externa y, mediante lógica de procesamiento de lenguaje, vincula los mensajes recibidos con la obra correspondiente de forma automática.
*   **Bitácora de Actividad:** Registro constante de cada acción realizada en el portal para auditorías internas.
*   **Generación de Reportes:** Exportación de listados consolidados en PDF o bases de datos estructurales en formato de intercambio de datos (JSON).

## 4. Arquitectura Funcional
Sin entrar en detalles de proveedores, el sistema se sustenta sobre tres pilares tecnológicos:
1.  **Capa de Interfaz Dinámica:** Basada en marcos de trabajo modernos para aplicaciones de alta disponibilidad.
2.  **Motor de Conectores Externos:** Capacidad de interactuar bidireccionalmente con gestores de tareas y servidores de archivos.
3.  **Lógica de Procesamiento Autónomo:** Algoritmos encargados de la clasificación de información, geocodificación y gestión de sesiones de seguridad.

---
**Departamento de Estudios Ambientales**
*Dirección de Programas y Proyectos*