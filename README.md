
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

### 3. Configuración en Google Cloud Console
1. **Suscripción PUSH (Configuración Correcta):**
   - Ve a tu Suscripción: `projects/studio-1428739321-e57bb/subscriptions/push_desde_gmail-sub`.
   - Clic en **Editar**.
   - **Tipo de entrega:** Seleccioná **PUSH**.
   - **URL de extremo:** `https://torquate-hoodlike-mariann.ngrok-free.dev/api/gmail-webhook`
   - Guarda los cambios.

## 🛠 Solución de Problemas

### Error: Puerto 9002 ya está ocupado
Si al ejecutar `npm run dev` ves este error, ejecutá:
`npx kill-port 9002`

### ¿Cómo ver los logs de los mails?
Los mails no aparecen en la consola del navegador. Aparecen en la **Terminal** donde corre el servidor (`npm run dev`). Busca mensajes que empiecen con `🔍 [RADAR]` o `[IA]`.

---
© 2024 Departamento de Estudios Ambientales
