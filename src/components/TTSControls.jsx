import { useState } from 'react'
import { tts } from '../services/api'

// Boton reproducir + selector de velocidad + boton limpiar.
// Props: history, onClear
export function TTSControls({ history, onClear }) {
  const [speed, setSpeed] = useState(1.0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  const text = history.map((item) => item.text).join(' ')

  async function handlePlay() {
    if (!text || playing) return
    setPlaying(true)
    setError(null)

    try {
      // Preferimos voz del navegador para leer exactamente el historial.
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'es-MX'
        utterance.rate = speed
        utterance.onend = () => setPlaying(false)
        utterance.onerror = () => {
          setError('Error al reproducir')
          setPlaying(false)
        }
        window.speechSynthesis.speak(utterance)
      } else {
        // Fallback al backend si speech synthesis no esta disponible.
        const result = await tts(text, speed)
        const url = URL.createObjectURL(result)
        const audio = new Audio(url)
        audio.onended = () => {
          setPlaying(false)
          URL.revokeObjectURL(url)
        }
        audio.play()
      }
    } catch (err) {
      setError('Error al reproducir')
      setPlaying(false)
    }
  }

  return (
    <div className="tts-bar">
      <div className="tts-left">
        <button
          className={`btn-play ${playing ? 'playing' : ''}`}
          onClick={handlePlay}
          disabled={!text || playing}
        >
          {playing ? 'reproduciendo' : 'reproducir'}
        </button>

        <select
          className="speed-select"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          disabled={playing}
        >
          <option value={0.75}>0.75x</option>
          <option value={1.0}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
        </select>

        {error && <span className="tts-error">{error}</span>}
      </div>

      <div className="tts-right">
        <button className="btn-clear" onClick={onClear} disabled={!text}>
          limpiar
        </button>
      </div>
    </div>
  )
}
