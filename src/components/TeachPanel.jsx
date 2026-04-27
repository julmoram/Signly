import { useEffect, useRef, useState } from 'react'
import { teachSample } from '../services/api'

export function TeachPanel({ ready, captureFrame }) {
  const [label, setLabel] = useState('')
  const [targetCount, setTargetCount] = useState(30)
  const [intervalMs, setIntervalMs] = useState(700)
  const [capturedCount, setCapturedCount] = useState(0)
  const [savedTotal, setSavedTotal] = useState(0)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Listo para guardar ejemplos')
  const [error, setError] = useState(null)
  const busyRef = useRef(false)

  async function captureAndSend() {
    if (!ready) return
    const normalized = label.trim()
    if (!normalized) {
      setError('Escribe una palabra primero')
      return
    }
    if (busyRef.current) return

    busyRef.current = true
    setBusy(true)
    setError(null)

    try {
      const blob = await captureFrame()
      if (!blob) throw new Error('No se pudo capturar frame')
      const result = await teachSample(blob, normalized)

      setCapturedCount((v) => v + 1)
      setSavedTotal(result.count ?? 0)
      setMessage(`Guardado en "${result.label}"`)
    } catch (err) {
      setError(err.message || 'No se pudo guardar muestra')
      setRecording(false)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!recording) return
    if (capturedCount >= targetCount) {
      setRecording(false)
      setMessage(`Lote terminado (${capturedCount} muestras)`)
      return
    }

    const timer = setTimeout(() => {
      captureAndSend()
    }, Math.max(200, intervalMs))
    return () => clearTimeout(timer)
  }, [recording, capturedCount, targetCount, intervalMs])

  function startBatch() {
    setCapturedCount(0)
    setRecording(true)
    setMessage('Capturando lote...')
    setError(null)
  }

  function stopBatch() {
    setRecording(false)
    setMessage('Captura detenida')
  }

  return (
    <div className="panel teach-panel">
      <div className="panel-header">
        <span className="panel-label">ensenar modelo</span>
      </div>

      <div className="teach-body">
        <label className="teach-field">
          <span className="teach-field-label">Palabra</span>
          <input
            className="teach-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ejemplo: Como"
            disabled={recording || busy}
          />
        </label>

        <label className="teach-field">
          <span className="teach-field-label">Muestras por lote</span>
          <input
            className="teach-input"
            type="number"
            min={1}
            max={300}
            value={targetCount}
            onChange={(e) => setTargetCount(Number(e.target.value || 1))}
            disabled={recording}
          />
        </label>

        <label className="teach-field">
          <span className="teach-field-label">Intervalo (ms)</span>
          <input
            className="teach-input"
            type="number"
            min={200}
            max={3000}
            step={100}
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value || 700))}
            disabled={recording}
          />
        </label>

        <div className="teach-actions">
          <button className="btn-play" onClick={captureAndSend} disabled={!ready || busy || recording}>
            Capturar 1
          </button>
          {!recording ? (
            <button className="btn-play" onClick={startBatch} disabled={!ready || busy}>
              Iniciar lote
            </button>
          ) : (
            <button className="btn-clear" onClick={stopBatch}>
              Detener
            </button>
          )}
        </div>

        <div className="teach-meta">
          <div className="teach-meta-row">
            <span>En este lote:</span>
            <strong>{capturedCount} / {targetCount}</strong>
          </div>
          <div className="teach-meta-row">
            <span>Total guardado para etiqueta:</span>
            <strong>{savedTotal}</strong>
          </div>
        </div>

        <div className="teach-message">{message}</div>
        {error && <div className="tts-error">{error}</div>}
      </div>
    </div>
  )
}
