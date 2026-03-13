
# Portal DEA - Departamento de Estudios Ambientales

Este es el portal centralizado para la gestión de proyectos y obras hidráulicas.

## 🚀 Configuración del Radar de Gmail (Tiempo Real)

Para que el sistema detecte correos de obras automáticamente mediante el flujo **Push**, seguí estos pasos:

### 1. Túnel de Desarrollo (Local)
Como Google Pub/Sub necesita una URL pública para enviarte notificaciones, usaremos **ngrok**:

```bash
# 1. Registra tu token (solo la primera vez)
npx ngrok config add-authtoken TU_TOKEN_DE_NGROK

# 2. Iniciá el túnel apuntando al puerto de la app
npx ngrok http 9002
```

Copiá la URL `https://...ngrok-free.app` que te devuelva la terminal.

### 2. Google Cloud Console
1. Creá un **Topic** en Pub/Sub (ej: `gmail-notifications`).
2. Creá una **Suscripción Push** para ese Topic.
3. En **Endpoint URL**, poné: `https://TU_URL_NGROK.app/api/gmail-webhook`.
4. Otorgá el rol de `Pub/Sub Publisher` a la cuenta `gmail-api-push@system.gserviceaccount.com` en tu Topic.

### 3. Variables de Entorno (.env)
Asegurate de tener:
- `GMAIL_PUB_SUB_TOPIC`: El nombre completo del topic (ej: `projects/tu-proyecto/topics/tu-tema`).
- `GOOGLE_CLIENT_ID_TL`, `GOOGLE_CLIENT_SECRET_TL`, `GOOGLE_REFRESH_TOKEN_TL`: Credenciales con alcance de Gmail.

---
© 2024 Departamento de Estudios Ambientales
