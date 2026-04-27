import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraFeed } from './components/CameraFeed'
import { TeachPanel } from './components/TeachPanel'
import { TranslationPanel } from './components/TranslationPanel'
import { TTSControls } from './components/TTSControls'
import { useCamera } from './hooks/useCamera'
import { usePredict } from './hooks/usePredict'

const DEBOUNCE_MS = 450

export default function App() {
  const [activeTab, setActiveTab] = useState('translate')
  const [isActive, setIsActive] = useState(false)
  const [sentence, setSentence] = useState([])
  const [history, setHistory] = useState([])
  const lastAddedRef = useRef({ word: null, time: 0 })

  const { videoRef, canvasRef, ready, error, captureFrame } = useCamera()
  const { result, confidence, loading } = usePredict({
    captureFrame,
    active: activeTab === 'translate' && isActive && ready,
    interval: 260,
  })

  useEffect(() => {
    if (!result) return
    const now = Date.now()
    const { word, time } = lastAddedRef.current
    if (word === result && now - time < DEBOUNCE_MS) return

    lastAddedRef.current = { word: result, time: now }
    setSentence((prev) => [...prev, result])
    setHistory((prev) => [
      ...prev,
      {
        text: result,
        time: new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
    ])
  }, [result])

  const handleToggle = useCallback(() => setIsActive((v) => !v), [])

  const handleClear = useCallback(() => {
    setSentence([])
    setHistory([])
    setIsActive(false)
  }, [])

  const modeLabel = activeTab === 'translate' ? (isActive ? 'traduciendo' : 'en espera') : 'modo ensenar'

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">Signly</div>

        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'translate' ? 'active' : ''}`}
            onClick={() => setActiveTab('translate')}
          >
            Traducir
          </button>
          <button
            className={`tab-btn ${activeTab === 'teach' ? 'active' : ''}`}
            onClick={() => setActiveTab('teach')}
          >
            Ensenar
          </button>
        </div>

        <div className="status">
          <span className={`status-dot ${ready ? 'on' : ''}`} />
          {ready ? modeLabel : 'iniciando camara'}
        </div>
      </header>

      <main className="main">
        <CameraFeed
          videoRef={videoRef}
          canvasRef={canvasRef}
          ready={ready}
          error={error}
          isActive={isActive}
          onToggle={handleToggle}
          showToggle={activeTab === 'translate'}
        />

        {activeTab === 'translate' ? (
          <TranslationPanel
            result={result}
            confidence={confidence}
            loading={loading}
            sentence={sentence}
            history={history}
          />
        ) : (
          <TeachPanel ready={ready} captureFrame={captureFrame} />
        )}
      </main>

      <footer className="footer">
        {activeTab === 'translate' ? (
          <TTSControls history={history} onClear={handleClear} />
        ) : (
          <div className="teach-footer-note">
            Las muestras se guardan en datasets/manual/&lt;palabra&gt;
          </div>
        )}
      </footer>
    </div>
  )
}
