
# Portal DEA - Departamento de Estudios Ambientales

Este es el portal centralizado para la gestión de proyectos y obras hidráulicas.

## 🚀 Configuración del Radar de Gmail (Tiempo Real)

### 1. Túnel de Desarrollo (ngrok)
Para que Google pueda avisarle a tu PC que entró un mail, necesitás ngrok corriendo:
1. `npx ngrok config add-authtoken TU_TOKEN`
2. `npx ngrok http 9002`
3. Tu URL actual es: `https://torquate-hoodlike-mariann.ngrok-free.dev`

### 2. Generar Refresh Token con Scopes Correctos (CRUCIAL)
Si ves el error "insufficient scopes", tenés que ir al [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) y generar un token que incluya estos 3 scopes exactos:
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/contacts.readonly`

Copiá el nuevo `Refresh Token` resultante en tu archivo `.env`.

### 3. Configuración en Google Cloud Console
1. **Permisos de Gmail:**
   - Ve a tu Topic: `projects/studio-1428739321-e57bb/topics/push_desde_gmail`.
   - Pestaña **Permisos** -> **Agregar Acceso**.
   - Miembro: `gmail-api-push@system.gserviceaccount.com`
   - Rol: `Pub/Sub Publisher`.

2. **Suscripción PUSH:**
   - Ve a tu Suscripción: `projects/studio-1428739321-e57bb/subscriptions/push_desde_gmail-sub`.
   - Clic en **Editar**.
   - **Tipo de entrega:** Seleccioná **PUSH** (No "Extracción").
   - **URL de extremo:** `https://torquate-hoodlike-mariann.ngrok-free.dev/api/gmail-webhook`
   - Guarda los cambios.

### 4. Activar en la App
- Asegúrate de tener en `.env`: `GMAIL_PUB_SUB_TOPIC=projects/studio-1428739321-e57bb/topics/push_desde_gmail`
- Abre el **Radar de Gmail** (icono de sobre).
- Haz clic en el botón del **Rayo (Zap)**. 
- Si sale el Check Verde, la conexión está establecida.

---
© 2024 Departamento de Estudios Ambientales
