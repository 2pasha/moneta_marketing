import { useEffect, useRef, useState } from 'react'
import introVideoUrl from '../assets/intro.mp4'
import './VideoOnboardingStep.css'

// loading -> ready -> playing -> ended
export default function VideoOnboardingStep({ onComplete }) {
  const [phase, setPhase] = useState('loading')
  const [progress, setProgress] = useState(0)
  const videoRef = useRef(null)
  const blobUrlRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadVideo() {
      const response = await fetch(introVideoUrl, { signal: controller.signal })
      const total = Number(response.headers.get('Content-Length')) || 0
      const reader = response.body.getReader()
      const chunks = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (total > 0) {
          setProgress(Math.min(100, Math.round((received / total) * 100)))
        }
      }

      const blob = new Blob(chunks, { type: 'video/mp4' })
      const blobUrl = URL.createObjectURL(blob)
      blobUrlRef.current = blobUrl
      setProgress(100)
      setPhase('ready')

      if (videoRef.current) {
        videoRef.current.src = blobUrl
      }
    }

    loadVideo().catch((err) => {
      if (err.name !== 'AbortError') console.error('Video load failed', err)
    })

    return () => {
      controller.abort()
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  const handleTapToStart = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = false
    video.play()
    setPhase('playing')
  }

  const handleEnded = () => {
    setPhase('ended')
    onComplete?.()
  }

  return (
    <div className="video-step">
      <video
        ref={videoRef}
        className="video-step__video"
        playsInline
        onEnded={handleEnded}
      />

      {phase === 'loading' && (
        <div className="video-step__overlay">
          <div className="video-step__progress-track">
            <div
              className="video-step__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="video-step__progress-label">{progress}%</span>
        </div>
      )}

      {phase === 'ready' && (
        <button
          type="button"
          className="video-step__tap-overlay"
          onClick={handleTapToStart}
        >
          <span className="video-step__play-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="video-step__tap-label">Tap to begin</span>
        </button>
      )}

      {(phase === 'playing' || phase === 'ended') && (
        <div className="video-step__tagline">
          <p>Привіт, я Паша і я тут щось розказую тобі</p>
        </div>
      )}
    </div>
  )
}
