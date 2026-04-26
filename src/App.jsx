import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraFeed } from './components/CameraFeed'
import { TranslationPanel } from './components/TranslationPanel'
import { TTSControls } from './components/TTSControls'
import { useCamera } from './hooks/useCamera'
import { usePredict } from './hooks/usePredict'

// Tiempo mínimo (ms) entre que se agrega la misma seña a la oración
const DEBOUNCE_MS = 1200

export default function App() {
  const [isActive, setIsActive] = useState(false)
  const [sentence, setSentence] = useState([])
  const [history, setHistory] = useState([])
  const lastAddedRef = useRef({ word: null, time: 0 })

  const { videoRef, canvasRef, ready, error, captureFrame } = useCamera()
  const { result, confidence, loading } = usePredict({
    captureFrame,
    active: isActive && ready,
    interval: 800,
  })

  // Agrega la seña a la oración con debounce para evitar repeticiones
  useEffect(() => {
    if (!result) return
    const now = Date.now()
    const { word, time } = lastAddedRef.current
    if (word === result && now - time < DEBOUNCE_MS) return

    lastAddedRef.current = { word: result, time: now }
    setSentence((prev) => [...prev, result])
    setHistory((prev) => [
      ...prev,
      { text: result, time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
    ])
  }, [result])

  const handleToggle = useCallback(() => setIsActive((v) => !v), [])

  const handleClear = useCallback(() => {
    setSentence([])
    setIsActive(false)
  }, [])

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="logo">Signly</div>
        <div className="status">
          <span className={`status-dot ${ready ? 'on' : ''}`} />
          {ready ? (isActive ? 'traduciendo' : 'en espera') : 'iniciando cámara'}
        </div>
        <div className="logo-sub">LSM · v0.1</div>
      </header>

      {/* Main */}
      <main className="main">
        <CameraFeed
          videoRef={videoRef}
          canvasRef={canvasRef}
          ready={ready}
          error={error}
          isActive={isActive}
          onToggle={handleToggle}
        />
        <TranslationPanel
          result={result}
          confidence={confidence}
          loading={loading}
          sentence={sentence}
          history={history}
        />
      </main>

      {/* Bottom bar */}
      <footer className="footer">
        <TTSControls sentence={sentence} onClear={handleClear} />
      </footer>
    </div>
  )
}
