
# Portal DEA - Departamento de Estudios Ambientales

Este es el portal centralizado para la gestión de proyectos y obras hidráulicas.

## 🚀 Configuración del Radar de Gmail (Tiempo Real)

Ya tenés **ngrok** corriendo correctamente. Según tu terminal, tu URL es:
`https://torquate-hoodlike-mariann.ngrok-free.dev`

### Siguientes Pasos en Google Cloud Console:

1. **Crear el Topic:**
   - Ve a [Google Cloud Pub/Sub](https://console.cloud.google.com/cloudpubsub/topic/list).
   - Crea un **Topic** (ej: `gmail-notifications`).

2. **Permisos de Gmail:**
   - En la configuración del Topic, ve a la pestaña **Permisos**.
   - Haz clic en **Agregar Acceso**.
   - Nuevo miembro: `gmail-api-push@system.gserviceaccount.com`
   - Rol: `Pub/Sub Publisher`.

3. **Crear la Suscripción Push:**
   - Dentro de tu Topic, ve a la pestaña **Suscripciones** y haz clic en **Crear Suscripción**.
   - ID de suscripción: `gmail-push-sub`.
   - Tipo de entrega: **Push**.
   - **Endpoint URL:** `https://torquate-hoodlike-mariann.ngrok-free.dev/api/gmail-webhook` (Asegúrate de incluir `/api/gmail-webhook` al final).

4. **Variables de Entorno (.env):**
   - Agrega: `GMAIL_PUB_SUB_TOPIC=projects/TU_PROYECTO_ID/topics/gmail-notifications`

5. **Activar en la App:**
   - En el portal, abre el **Radar de Gmail** (icono de sobre).
   - Haz clic en el botón del **Rayo (Zap)** para registrar el "Watch" oficial.

---
© 2024 Departamento de Estudios Ambientales
