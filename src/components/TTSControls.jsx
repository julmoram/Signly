import { useState } from 'react'
import { tts } from '../services/api'

// Botón reproducir + selector de velocidad + botón limpiar.
// Props: sentence, onClear
export function TTSControls({ sentence, onClear }) {
  const [speed, setSpeed] = useState(1.0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  const text = sentence.join(' ')

  async function handlePlay() {
    if (!text || playing) return
    setPlaying(true)
    setError(null)

    try {
      const result = await tts(text, speed)

      if (result?.mock) {
        // Mock: usar Web Speech API del navegador
        const utterance = new SpeechSynthesisUtterance(result.text)
        utterance.lang = 'es-MX'
        utterance.rate = result.speed
        utterance.onend = () => setPlaying(false)
        window.speechSynthesis.speak(utterance)
      } else {
        // Backend real: reproducir el blob de audio
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
          {playing ? '◼ reproduciendo' : '▶ reproducir'}
        </button>

        <select
          className="speed-select"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          disabled={playing}
        >
          <option value={0.75}>0.75×</option>
          <option value={1.0}>1×</option>
          <option value={1.25}>1.25×</option>
          <option value={1.5}>1.5×</option>
        </select>

        {error && <span className="tts-error">{error}</span>}
      </div>

      <div className="tts-right">
        <button className="btn-clear" onClick={onClear} disabled={!text}>
          ✕ limpiar
        </button>
      </div>
    </div>
  )
}
