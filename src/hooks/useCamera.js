import { useEffect, useRef, useState } from 'react'

// Inicializa getUserMedia y adjunta el stream al <video> ref que retorna.
// Retorna: { videoRef, canvasRef, ready, error }
export function useCamera() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        if (!active) return
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play()
            setReady(true)
          }
        }
      } catch (err) {
        if (!active) return
        setError(err.message || 'No se pudo acceder a la cámara')
      }
    }

    start()

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Captura el frame actual del video y lo devuelve como Blob JPEG
  function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !ready) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    })
  }

  return { videoRef, canvasRef, ready, error, captureFrame }
}
