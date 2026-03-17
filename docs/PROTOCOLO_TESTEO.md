# Protocolo de Testeo Exhaustivo - Portal DEA
**Versión:** 1.0
**Estándar de Confiabilidad:** Alta disponibilidad y consistencia de datos.

Este documento detalla los pasos necesarios para validar la aplicación antes de su paso a producción. Cada prueba debe marcarse como exitosa (OK) o fallida (FAIL).

---

## 1. Fase de Acceso y Seguridad
- [ ] **Ingreso Autorizado:** Iniciar sesión con un correo presente en `WHITELIST` (Personal Interno). Debe redirigir al Home.
- [ ] **Ingreso Denegado:** Intentar ingresar con un correo personal no autorizado. Debe mostrar pantalla de "Acceso Denegado".
- [ ] **Persistencia de Sesión:** Refrescar la página (F5) después de loguearse. No debe pedir login nuevamente.
- [ ] **Cierre de Sesión:** Validar que el botón "Cerrar Sesión" limpie los datos y redirija a la pantalla de bienvenida.

## 2. Gestión de Proyectos (Trello + Drive)
- [ ] **Creación de Proyecto:** 
    - Completar el formulario con nombre, cuenca y responsables.
    - Verificar: ¿Se creó la tarjeta en la lista correcta de Trello? ¿Tiene la descripción con la plantilla completa?
    - Verificar: ¿Se creó la carpeta en Google Drive con el nombre `CÓDIGO - Nombre`?
- [ ] **Compartir automático:** Verificar que los responsables seleccionados en el formulario recibieron invitación de edición en la carpeta de Drive.
- [ ] **Edición de Proyecto:** Cambiar el estado de un proyecto. Verificar que se añade un comentario en Trello indicando el cambio de estado.
- [ ] **Código Correlativo:** Crear dos proyectos en la misma cuenca seguidos. El segundo debe tener el número siguiente (ej: MAR001 -> MAR002).

## 3. Radar de Gmail e IA (Sabueso de Obras)
- [ ] **Suscripción Push:** Al cargar la app, el icono del rayo debe ponerse verde/activo automáticamente (si está configurado).
- [ ] **Detección por Lugar (IA):** Enviar un mail con el asunto "Presupuesto para Pergamino". Verificar que la IA lo vincula a una obra que contenga "Pergamino" en el nombre.
- [ ] **Detección por Hilo (Thread):** Responder a un mail antiguo de un proyecto sin mencionar el lugar. La IA debe buscar en la cadena y encontrar la relación.
- [ ] **Notificaciones en Tiempo Real:** Mantener la app abierta y enviar un mail. Debe aparecer el Toast (cartelito) de notificación en menos de 10 segundos.
- [ ] **Bandeja de Pendientes:** El panel del Radar solo debe mostrar correos con estado "nuevo". Al hacer clic en uno, debe desaparecer de la lista.

## 4. Línea de Tiempo (Timeline)
- [ ] **Sincronización Automática:** Añadir un comentario y un archivo adjunto directamente en Trello. Entrar a la TL y verificar que aparecieron como hitos automáticamente.
- [ ] **Hito Manual con Drive:** Crear un hito desde la app subiendo una foto. 
    - Verificar: ¿La foto está en la carpeta de Drive del proyecto? ¿Aparece el link en la tarjeta de Trello?
- [ ] **Conflicto de Archivos:** Intentar subir un archivo que ya existe en Drive. Validar que aparece el diálogo de "Renombrar / Sobrescribir / Omitir".
- [ ] **Borrado Seguro:** Eliminar un hito manual. Verificar que se borre el archivo de Drive y el link de Trello para no dejar basura.

## 5. Biblioteca de Recursos
- [ ] **Búsqueda Local:** Buscar "Matanza". Debe filtrar los recursos estáticos del departamento.
- [ ] **Búsqueda Externa:** Buscar términos técnicos. Verificar resultados de Elsevier, SNRD y Crossref.
- [ ] **Vínculo a Proyecto:** Seleccionar un artículo científico y usar el icono del "Clip" para adjuntarlo a un proyecto. Verificar que el link aparece en Trello.

## 6. Bitácora de Actividad
- [ ] **Registro de Acciones:** Realizar una creación, una edición y una descarga de PDF. 
- [ ] **Auditoría:** Abrir la Bitácora y verificar que figuran el nombre del usuario, la hora exacta y el detalle de la acción.
- [ ] **Navegación desde Bitácora:** Hacer clic en una entrada de la bitácora. Debe seleccionar el proyecto correspondiente en el mapa y el buscador.

## 7. UX, Mapas y Reportes
- [ ] **Geolocalización Automática:** En Trello, poner `#Luján` en la descripción. En la app, seleccionar ese proyecto. El mapa debe centrarse en Luján.
- [ ] **Exportación PDF:** Generar el reporte de un proyecto y la lista general. Verificar que los links en el PDF son clickeables.
- [ ] **Respuesta Móvil:** Abrir la app desde un celular. Los paneles deben ser usables y no cortarse.

---
**Aprobación Final:** ______________________ **Fecha:** ____/____/____
