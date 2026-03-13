
# Portal DEA - Departamento de Estudios Ambientales

Este es el portal centralizado para la gestión de proyectos y obras hidráulicas.

## 🚀 Configuración del Radar de Gmail (Tiempo Real)

### 1. Túnel de Desarrollo (ngrok)
Para que Google pueda avisarle a tu PC que entró un mail, necesitás ngrok corriendo:
1. `npx ngrok config add-authtoken TU_TOKEN`
2. `npx ngrok http 9002`
3. Tu URL actual es: `https://torquate-hoodlike-mariann.ngrok-free.dev`

### 2. Generar Refresh Token con Scopes Correctos (CRUCIAL)
Si ves el error "insufficient scopes", seguí estos pasos exactos:

1.  **Configurar tus Credenciales en el [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):**
    *   Clic en el icono de **Engranaje (Settings)** arriba a la derecha.
    *   Tildar la casilla **"Use your own OAuth credentials"**.
    *   Pegar tu `OAuth Client ID` y `OAuth Client Secret` (los que tenés en el `.env`).
    *   Clic en **Close**.
2.  **Seleccionar Scopes:**
    *   En el cuadro "Input your own scopes" a la izquierda, pegar estos 3 separados por espacio:
        `https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/contacts.readonly`
    *   Clic en **Authorize APIs**.
3.  **Obtener Token:**
    *   Logueate con la cuenta de ambientales.
    *   En el "Step 2", clic en **Exchange authorization code for tokens**.
    *   Copiá el **Refresh Token** resultante y pegalo en tu `.env`.

**IMPORTANTE:** Si tenés variables con el sufijo `_TL` en tu `.env` (como `GOOGLE_CLIENT_ID_TL`), asegurate de que tengan los mismos valores que las normales, o borralas si no las estás usando, ya que la app podría estar priorizando valores viejos.

### 3. Configuración en Google Cloud Console
1. **Permisos de Gmail:**
   - Ve a tu Topic: `projects/studio-1428739321-e57bb/topics/push_desde_gmail`.
   - Pestaña **Permisos** -> **Agregar Acceso**.
   - Miembro: `gmail-api-push@system.gserviceaccount.com`
   - Rol: **Pub/Sub Publisher**.

2. **Suscripción PUSH (NO extracción):**
   - Ve a tu Suscripción: `projects/studio-1428739321-e57bb/subscriptions/push_desde_gmail-sub`.
   - Clic en **Editar**.
   - **Tipo de entrega:** Seleccioná **PUSH**.
   - **URL de extremo:** `https://torquate-hoodlike-mariann.ngrok-free.dev/api/gmail-webhook`
   - Guarda los cambios.

### 4. Activar en la App
- Asegúrate de tener en `.env`: `GMAIL_PUB_SUB_TOPIC=projects/studio-1428739321-e57bb/topics/push_desde_gmail`
- Abre el **Radar de Gmail** (icono de sobre).
- Haz clic en el botón del **Rayo (Zap)**. 
- Si sale el Check Verde, la conexión está establecida.

---
© 2024 Departamento de Estudios Ambientales
