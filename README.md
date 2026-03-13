
# Portal DEA - Departamento de Estudios Ambientales

Este es el portal centralizado para la gestión de proyectos y obras hidráulicas.

## 🚀 Configuración del Radar de Gmail (Tiempo Real)

Ya tenés **ngrok** corriendo correctamente. Según tu terminal, tu URL es:
`https://torquate-hoodlike-mariann.ngrok-free.dev`

### Siguientes Pasos en Google Cloud Console:

1. **Permisos de Gmail (Crucial):**
   - Ve a tu Topic: `projects/studio-1428739321-e57bb/topics/push_desde_gmail`.
   - Ve a la pestaña **Permisos**.
   - Haz clic en **Agregar Acceso**.
   - Nuevo miembro: `gmail-api-push@system.gserviceaccount.com`
   - Rol: `Pub/Sub Publisher`. (Sin esto, Gmail no puede escribir en tu topic).

2. **Configurar la Suscripción como PUSH:**
   - Ve a tu Suscripción: `projects/studio-1428739321-e57bb/subscriptions/push_desde_gmail-sub`.
   - Haz clic en **Editar**.
   - En **Tipo de entrega**, selecciona **PUSH** (ahora lo tienes en "Extracción/Pull").
   - **URL de extremo:** `https://torquate-hoodlike-mariann.ngrok-free.dev/api/gmail-webhook`
   - Guarda los cambios.

3. **Variables de Entorno (.env):**
   - Asegúrate de tener: `GMAIL_PUB_SUB_TOPIC=projects/studio-1428739321-e57bb/topics/push_desde_gmail`

4. **Activar en la App:**
   - Abre el **Radar de Gmail** (icono de sobre).
   - Haz clic en el botón del **Rayo (Zap)**. 
   - Si sale el Check Verde, Gmail ya tiene órdenes de avisar a tu Topic cada vez que entre un mail.

---
© 2024 Departamento de Estudios Ambientales
