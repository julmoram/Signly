import { useEffect, useRef } from 'react'

// Muestra la seña actual, la oración formada e historial.
// Props: result, confidence, loading, sentence, history
export function TranslationPanel({ result, confidence, loading, sentence, history }) {
  const histRef = useRef(null)

  // Auto-scroll al historial nuevo
  useEffect(() => {
    if (histRef.current) {
      histRef.current.scrollTop = histRef.current.scrollHeight
    }
  }, [history])

  const confPercent = confidence != null ? Math.round(confidence * 100) : null
  const confColor =
    confPercent == null ? '' : confPercent >= 90 ? 'high' : confPercent >= 70 ? 'mid' : 'low'

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-label">traducción</span>
        {confPercent != null && (
          <span className={`conf-badge ${confColor}`}>{confPercent}%</span>
        )}
        {loading && <span className="loading-pill">analizando…</span>}
      </div>

      {/* Seña actual */}
      <div className="current-sign">
        {result ? (
          <>
            <span className="sign-word">{result}</span>
          </>
        ) : (
          <span className="sign-placeholder">—</span>
        )}
      </div>

      {/* Oración formada */}
      <div className="sentence-box">
        <div className="section-label">oración</div>
        <div className="sentence-text">
          {sentence.length === 0 ? (
            <span className="sentence-empty">Las palabras aparecerán aquí…</span>
          ) : (
            sentence.map((word, i) => (
              <span key={i} className="sentence-token">
                {word}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Historial */}
      <div className="history-box">
        <div className="section-label">historial</div>
        <div className="history-list" ref={histRef}>
          {history.length === 0 ? (
            <span className="sentence-empty">Sin historial aún</span>
          ) : (
            [...history].reverse().map((item, i) => (
              <div key={i} className="history-item">
                <span className="history-word">{item.text}</span>
                <span className="history-time">{item.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
