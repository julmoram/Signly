// ─── Configuración ────────────────────────────────────────────────
// Cambia VITE_MOCK=false en .env cuando el backend de tus compañeros esté listo.
// En desarrollo sin backend, las respuestas son simuladas.
const USE_MOCK = import.meta.env.VITE_MOCK !== 'false'

// Señas de ejemplo para el mock
const MOCK_SIGNS = [
  'Hola', 'Gracias', 'Por favor', 'Buenos días',
  'Sí', 'No', 'Ayuda', 'Agua', 'Casa', 'Familia',
]
let mockIndex = 0

// ─── predict ──────────────────────────────────────────────────────
// Envía un frame (Blob) al endpoint POST /predict
// Recibe: { prediction: string }
export async function predict(blob) {
  if (USE_MOCK) {
    await delay(180)
    const prediction = MOCK_SIGNS[mockIndex % MOCK_SIGNS.length]
    mockIndex++
    return { prediction, confidence: +(0.85 + Math.random() * 0.14).toFixed(3) }
  }

  const form = new FormData()
  form.append('file', blob, 'frame.jpg')

  const res = await fetch('/predict', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`/predict error ${res.status}`)

  const data = await res.json()
  // El backend devuelve { prediction: string }
  // Agregamos confidence por si el back lo incluye en el futuro
  return { prediction: data.prediction, confidence: data.confidence ?? null }
}

// ─── tts ──────────────────────────────────────────────────────────
// Envía texto a POST /tts y devuelve un Blob de audio (mp3)
export async function tts(text, speed = 1.0) {
  if (USE_MOCK) {
    // En mock usamos la Web Speech API del navegador directamente
    return { mock: true, text, speed }
  }

  const res = await fetch('/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speed }),
  })
  if (!res.ok) throw new Error(`/tts error ${res.status}`)
  return await res.blob()
}

// ─── Util ─────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
