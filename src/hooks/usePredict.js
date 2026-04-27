import { useCallback, useEffect, useRef, useState } from 'react'
import { predict } from '../services/api'

// Llama a /predict cada `interval` ms mientras `active` sea true.
// Retorna: { result, confidence, loading, error }
export function usePredict({ captureFrame, active = true, interval = 260 }) {
  const [result, setResult] = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const runningRef = useRef(false)

  const runOnce = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setLoading(true)

    try {
      const blob = await captureFrame()
      if (!blob) return
      const data = await predict(blob)
      setResult(data.prediction)
      setConfidence(data.confidence)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      runningRef.current = false
    }
  }, [captureFrame])

  useEffect(() => {
    if (!active) {
      clearInterval(timerRef.current)
      return
    }
    // Primer frame inmediato para no esperar el primer intervalo.
    runOnce()
    timerRef.current = setInterval(runOnce, interval)
    return () => clearInterval(timerRef.current)
  }, [active, interval, runOnce])

  return { result, confidence, loading, error }
}
