# Signly — Frontend

Interfaz web del traductor de lengua de señas. Construida con **React + Vite**. Se comunica con el backend FastAPI para enviar frames de cámara y recibir la seña detectada.

---

## Requisitos

- Node.js 18+
- npm 9+

---

## Instalación

```bash
npm install
```

---

## Correr en desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173` en el navegador.

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto (ya viene uno por defecto):

| Variable | Valores | Descripción |
|---|---|---|
| `VITE_MOCK` | `true` / `false` | `true` = respuestas simuladas sin backend. `false` = conecta al servidor FastAPI. |

### Modo mock (sin backend)

```env
VITE_MOCK=true
```

El frontend simula detecciones con palabras de prueba cada 800ms. Útil para desarrollar la UI sin depender del backend.

### Modo real (con backend)

```env
VITE_MOCK=false
```

Requiere que el servidor FastAPI esté corriendo en `http://localhost:8000`.

---

## Estructura de archivos

```
frontend/
├── index.html
├── vite.config.js          # Proxy hacia FastAPI en :8000
├── package.json
├── .env                    # Variables de entorno (no subir a git)
├── .env.example            # Plantilla de variables
└── src/
    ├── main.jsx            # Punto de entrada React
    ├── App.jsx             # Componente raíz + estado global
    ├── index.css           # Design system completo
    ├── components/
    │   ├── CameraFeed.jsx       # Stream de video + overlay de estado
    │   ├── TranslationPanel.jsx # Seña actual, oración e historial
    │   └── TTSControls.jsx      # Botón reproducir + velocidad
    ├── hooks/
    │   ├── useCamera.js    # Acceso a getUserMedia + captureFrame()
    │   └── usePredict.js   # Polling al endpoint /predict cada 800ms
    └── services/
        └── api.js          # Cliente HTTP con fallback a mock
```

---

## Endpoints del backend que consume

### `POST /predict`

Recibe un frame de la cámara y devuelve la seña detectada.

**Request:**
```
Content-Type: multipart/form-data
Body: { file: <imagen JPEG como Blob> }
```

**Response:**
```json
{
  "prediction": "Hola",
  "confidence": 0.97
}
```

---

### `POST /tts`

Recibe texto y devuelve audio MP3.

**Request:**
```json
{
  "text": "Hola Gracias",
  "speed": 1.0
}
```

**Response:**
```
Content-Type: audio/mpeg
Body: <bytes del audio>
```

> En modo mock el TTS usa la Web Speech API del navegador directamente, sin llamar al backend.

---

## Flujo de la app

```
Webcam → useCamera (captura frame JPEG)
       → usePredict (POST /predict cada 800ms)
       → App (debounce 1.2s, forma oración)
       → TranslationPanel (muestra resultado)
       → TTSControls (POST /tts o Web Speech API)
```

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción en `/dist` |
| `npm run preview` | Preview del build de producción |

---

## Notas para el equipo

- El proxy de Vite (`vite.config.js`) redirige `/predict` y `/tts` a `localhost:8000` automáticamente en desarrollo, así no hay problemas de CORS.
- Al pasar a producción, el backend debe configurar CORS o servir el frontend desde el mismo origen.
- El campo `confidence` en `/predict` es opcional por ahora — si el backend no lo incluye, simplemente no se muestra el badge de porcentaje.
- Para agregar nuevas señas al mock, edita el array `MOCK_SIGNS` en `src/services/api.js`.