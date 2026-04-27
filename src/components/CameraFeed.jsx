import { useEffect, useState } from 'react'

// Muestra el stream de video con overlay de estado.
// Props: videoRef, canvasRef, ready, error, isActive, onToggle, showToggle
export function CameraFeed({
  videoRef,
  canvasRef,
  ready,
  error,
  isActive,
  onToggle,
  showToggle = true,
}) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (ready) return
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 400)
    return () => clearInterval(t)
  }, [ready])

  return (
    <div className="camera-wrap">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <video
        ref={videoRef}
        className="camera-video"
        muted
        playsInline
        style={{ opacity: ready ? 1 : 0 }}
      />

      {!ready && !error && (
        <div className="camera-overlay">
          <div className="cam-spinner" />
          <span className="cam-status-text">Iniciando camara{dots}</span>
        </div>
      )}

      {error && (
        <div className="camera-overlay">
          <div className="cam-error-icon">!</div>
          <span className="cam-status-text">{error}</span>
          <span className="cam-hint">Revisa los permisos del navegador</span>
        </div>
      )}

      {ready && (
        <>
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
          <div className={`cam-active-dot ${isActive ? 'live' : ''}`} />
          <div className="cam-fps">640 x 480</div>
        </>
      )}

      {ready && showToggle && (
        <button className={`cam-toggle ${isActive ? 'active' : ''}`} onClick={onToggle}>
          {isActive ? 'Pausar' : 'Traducir'}
        </button>
      )}
    </div>
  )
}
