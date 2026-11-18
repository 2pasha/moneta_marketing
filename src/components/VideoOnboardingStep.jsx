import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DrawablyButton,
  DrawablyCard,
  DrawablyCircle,
  DrawablyDivider,
  DrawablyUnderline,
} from 'drawably/react'
import { roughCircle, variants } from 'drawably'
import 'drawably/style.css'
import 'drawably/font.css'
import './VideoOnboardingStep.css'

const BASE_URL = import.meta.env.BASE_URL || '/'
const MONETA_APP_URL = 'https://moneta-web.vercel.app/'

const VIDEOS = {
  '1': {
    id: '1',
    src: `${BASE_URL}videos/1.mp4`,
    poster: `${BASE_URL}videos/poster-1.jpg`,
    aspect: 'portrait',
    stepIndex: 0,
    preloadNext: ['2', '3'],
    choices: [
      {
        id: 'yes',
        label: 'так',
        target: '2',
        seed: 210948902,
      },
      {
        id: 'no',
        label: 'ні',
        target: '3',
        seed: 482910374,
      },
    ],
  },
  '2': {
    id: '2',
    src: `${BASE_URL}videos/2.mp4`,
    aspect: 'portrait',
    stepIndex: 1,
    preloadNext: ['4', '5'],
    choices: [
      {
        id: 'demo',
        label: 'демо',
        target: '4',
        seed: 210948902,
      },
    ],
  },
  '3': {
    id: '3',
    src: `${BASE_URL}videos/3.mp4`,
    aspect: 'portrait',
    stepIndex: 1,
    preloadNext: ['4', '5'],
    choices: [
      {
        id: 'watch-anyway',
        label: 'всеодно подивитися',
        target: '4',
        seed: 210948902,
      },
      {
        id: 'exit',
        label: 'ясно',
        target: 'exit',
        seed: 739104215,
      },
    ],
  },
  '4': {
    id: '4',
    src: `${BASE_URL}videos/4.mp4`,
    aspect: 'landscape',
    stepIndex: 2,
    preloadNext: ['5'],
    autoNext: '5',
    choices: [],
  },
  '5': {
    id: '5',
    src: `${BASE_URL}videos/5.mp4`,
    aspect: 'portrait',
    stepIndex: 3,
    preloadNext: [],
    choices: [
      {
        id: 'open-moneta',
        label: 'відкрити Монету',
        target: 'external',
        url: MONETA_APP_URL,
        seed: 210948902,
      },
    ],
  },
}

const TOTAL_STEPS = 4

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

/**
 * Hand-sketched boiling circle icon for the play button
 */
function SketchPlayCircle({ seed = 210948902, size = 76 }) {
  const frames = useMemo(
    () =>
      variants((o) => roughCircle(size / 2, size / 2, size / 2 - 5, o), {
        seed,
        roughness: 0.6,
        boil: 0.4,
      }),
    [seed, size]
  )

  return (
    <span className="video-step__play-icon" aria-hidden="true">
      <svg
        className="drawably-svg video-step__play-ring-svg"
        viewBox={`0 0 ${size} ${size}`}
        style={{ '--drawably-stroke': '#ffffff', '--drawably-width': 2.2 }}
      >
        {frames.map((d, i) => (
          <path
            key={i}
            d={d}
            className="drawably-boil"
            data-i={String(i)}
          />
        ))}
      </svg>
      <svg
        className="video-step__play-triangle"
        viewBox="0 0 24 24"
        width="30"
        height="30"
        fill="currentColor"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  )
}

export default function VideoOnboardingStep() {
  const [videoId, setVideoId] = useState('1')
  const [hasStarted, setHasStarted] = useState(false)
  // 'idle' | 'playing' | 'paused' | 'ended' | 'exited'
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [is2x, setIs2x] = useState(false)
  const [speedToast, setSpeedToast] = useState(null)
  const [isBuffering, setIsBuffering] = useState(false)
  const [history, setHistory] = useState([])
  const [isLandscapeExpanded, setIsLandscapeExpanded] = useState(false)

  const videoRef = useRef(null)
  const stageRef = useRef(null)
  const isMutedRef = useRef(false)
  const is2xRef = useRef(false)
  const holdTimerRef = useRef(null)
  const wasHold2xRef = useRef(false)
  const toastTimerRef = useRef(null)
  const blobCacheRef = useRef({})
  const inflightFetchRef = useRef({})

  const currentConfig = VIDEOS[videoId]

  // Background preloader for upcoming video branches
  const preloadVideoBranch = useCallback((targetId) => {
    const config = VIDEOS[targetId]
    if (!config) return
    if (blobCacheRef.current[targetId] || inflightFetchRef.current[targetId]) {
      return
    }

    const controller = new AbortController()
    inflightFetchRef.current[targetId] = controller

    fetch(config.src, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        blobCacheRef.current[targetId] = blobUrl
      })
      .catch(() => {
        // Fallback to direct progressive MP4 URL if background prefetch fails
      })
      .finally(() => {
        delete inflightFetchRef.current[targetId]
      })
  }, [])

  // Mount initial video src and cleanup blobs on unmount
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.src = VIDEOS['1'].src
      video.load()
    }
    preloadVideoBranch('2')
    preloadVideoBranch('3')

    return () => {
      clearTimeout(holdTimerRef.current)
      clearTimeout(toastTimerRef.current)
      Object.values(inflightFetchRef.current).forEach((ctrl) => ctrl.abort())
      Object.values(blobCacheRef.current).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [preloadVideoBranch])

  const applyPlaybackSpeed = useCallback((fast, showFeedback = true) => {
    is2xRef.current = fast
    setIs2x(fast)
    const video = videoRef.current
    if (video) {
      video.playbackRate = fast ? 2 : 1
    }
    if (showFeedback) {
      setSpeedToast(fast ? '2x »' : '1x')
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => {
        setSpeedToast(null)
      }, 900)
    }
  }, [])

  // Trigger preloading of next branches whenever videoId changes
  useEffect(() => {
    const nextIds = VIDEOS[videoId]?.preloadNext || []
    nextIds.forEach((id) => preloadVideoBranch(id))
  }, [videoId, preloadVideoBranch])

  // Exit fullscreen if we leave video 4
  useEffect(() => {
    if (videoId !== '4') {
      setIsLandscapeExpanded(false)
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
    }
  }, [videoId])

  const playVideoById = useCallback(
    (nextId, pushCurrentToHistory = true) => {
      const nextConfig = VIDEOS[nextId]
      if (!nextConfig) return

      if (pushCurrentToHistory) {
        setHistory((prev) => [...prev, videoId])
      }

      setVideoId(nextId)
      setProgress(0)
      setCurrentTime(0)
      setDuration(0)
      setIsBuffering(true)
      setPhase('playing')

      const video = videoRef.current
      if (video) {
        const nextSrc = blobCacheRef.current[nextId] || nextConfig.src
        video.pause()
        video.src = nextSrc
        video.currentTime = 0
        video.muted = isMutedRef.current
        video.playbackRate = is2xRef.current ? 2 : 1
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              video.playbackRate = is2xRef.current ? 2 : 1
              setIsBuffering(false)
            })
            .catch(() => {
              setIsBuffering(false)
              setPhase('paused')
            })
        }
      }
    },
    [videoId]
  )

  const handleInitialStart = () => {
    const video = videoRef.current
    if (!video) return
    setHasStarted(true)
    isMutedRef.current = false
    setIsMuted(false)
    video.muted = false
    video.currentTime = 0
    video.playbackRate = is2xRef.current ? 2 : 1
    setPhase('playing')
    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        video.muted = true
        isMutedRef.current = true
        setIsMuted(true)
        video.play().catch(() => setPhase('paused'))
      })
    }
  }

  const isRightSideEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0
    return clientX - rect.left >= rect.width * 0.65
  }

  const handleFramePointerDown = (e) => {
    if (!hasStarted || phase === 'ended' || phase === 'exited') return
    if (!isRightSideEvent(e)) return

    wasHold2xRef.current = false
    clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      if (!is2xRef.current) {
        wasHold2xRef.current = true
        applyPlaybackSpeed(true, true)
      }
    }, 260)
  }

  const handleFramePointerUp = () => {
    clearTimeout(holdTimerRef.current)
    if (wasHold2xRef.current) {
      applyPlaybackSpeed(false, true)
    }
  }

  const handleVideoTap = (e) => {
    if (!hasStarted || phase === 'ended' || phase === 'exited') return
    if (wasHold2xRef.current) {
      wasHold2xRef.current = false
      return
    }

    const video = videoRef.current
    if (!video) return

    // Clicking on the right side toggles 2x playback speed
    if (isRightSideEvent(e)) {
      const nextFast = !is2xRef.current
      applyPlaybackSpeed(nextFast, true)
      if (video.paused) {
        video.play()
        setPhase('playing')
      }
      return
    }

    if (video.paused) {
      video.play()
      setPhase('playing')
    } else {
      video.pause()
      setPhase('paused')
    }
  }

  const handleToggleSpeedBtn = (e) => {
    e.stopPropagation()
    applyPlaybackSpeed(!is2xRef.current, true)
  }

  const handleToggleMute = (e) => {
    e.stopPropagation()
    const video = videoRef.current
    const nextMuted = !isMuted
    isMutedRef.current = nextMuted
    setIsMuted(nextMuted)
    if (video) {
      video.muted = nextMuted
    }
  }

  const handleGoBack = (e) => {
    e.stopPropagation()
    if (history.length === 0) return
    const prevId = history[history.length - 1]
    setHistory((prev) => prev.slice(0, -1))
    playVideoById(prevId, false)
  }

  const handleRestart = (e) => {
    e?.stopPropagation()
    setHistory([])
    setIsLandscapeExpanded(false)
    setHasStarted(true)
    playVideoById('1', false)
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video || !video.duration) return
    const ct = video.currentTime
    const dur = video.duration
    setCurrentTime(ct)
    setDuration(dur)
    setProgress(Math.min(100, (ct / dur) * 100))
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = is2xRef.current ? 2 : 1
    setDuration(video.duration || 0)
    setIsBuffering(false)
  }

  const handleEnded = () => {
    setIsBuffering(false)
    setProgress(100)

    if (currentConfig.autoNext) {
      setIsLandscapeExpanded(false)
      playVideoById(currentConfig.autoNext, true)
      return
    }

    setPhase('ended')
  }

  const handleChoiceClick = (choice, e) => {
    e.stopPropagation()
    if (choice.target === 'external') {
      window.location.href = choice.url
      return
    }
    if (choice.target === 'exit') {
      const video = videoRef.current
      if (video) video.pause()
      setPhase('exited')
      return
    }
    playVideoById(choice.target, true)
  }

  const handleSeek = (e) => {
    e.stopPropagation()
    const video = videoRef.current
    if (!video || !video.duration) return
    const nextPct = Number(e.target.value)
    const nextTime = (nextPct / 100) * video.duration
    video.currentTime = nextTime
    setProgress(nextPct)
    setCurrentTime(nextTime)
  }

  const handleToggleLandscape = async (e) => {
    e.stopPropagation()
    const nextExpanded = !isLandscapeExpanded
    setIsLandscapeExpanded(nextExpanded)

    try {
      if (nextExpanded && stageRef.current?.requestFullscreen) {
        await stageRef.current.requestFullscreen()
        await screen.orientation?.lock?.('landscape').catch(() => {})
      } else if (!nextExpanded && document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // CSS 90deg full-viewport expansion handles iOS Safari and locked portrait phones
    }
  }

  const isLandscapeVideo = currentConfig.aspect === 'landscape'

  return (
    <div
      ref={stageRef}
      className={[
        'video-step',
        isLandscapeVideo ? 'video-step--landscape-video' : 'video-step--portrait-video',
        isLandscapeExpanded ? 'video-step--rotated-fullscreen' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="video-step__frame"
        onClick={handleVideoTap}
        onPointerDown={handleFramePointerDown}
        onPointerUp={handleFramePointerUp}
        onPointerCancel={handleFramePointerUp}
        onPointerLeave={handleFramePointerUp}
      >
        {/* Main HTML5 Video Element */}
        <video
          ref={videoRef}
          className={`video-step__video ${
            isLandscapeVideo ? 'video-step__video--contain' : 'video-step__video--cover'
          }`}
          poster={videoId === '1' ? VIDEOS['1'].poster : undefined}
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onEnded={handleEnded}
        />

        {/* Top Stories Progress Bar + Navigation Header */}
        {phase !== 'exited' && (
          <div className="video-step__top-bar" onClick={(e) => e.stopPropagation()}>
            <div className="video-step__stories-track" aria-label="Прогрес історії">
              {Array.from({ length: TOTAL_STEPS }).map((_, idx) => {
                let fillWidth = 0
                if (idx < currentConfig.stepIndex) {
                  fillWidth = 100
                } else if (idx === currentConfig.stepIndex) {
                  fillWidth = phase === 'ended' ? 100 : progress
                }
                return (
                  <div key={idx} className="video-step__story-segment">
                    <div
                      className="video-step__story-fill"
                      style={{ width: `${fillWidth}%` }}
                    />
                  </div>
                )
              })}
            </div>

            <div className="video-step__header-controls">
              <div className="video-step__header-left">
                {history.length > 0 && (
                  <DrawablyButton
                    seed={9102841}
                    roughness={0.55}
                    boil={0.35}
                    stroke="#ffffff"
                    width={2}
                    className="video-step__sketch-icon-btn"
                    onClick={handleGoBack}
                    aria-label="Попереднє відео"
                    title="Назад"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </DrawablyButton>
                )}

                {(videoId !== '1' || phase === 'ended') && (
                  <DrawablyButton
                    seed={5519283}
                    roughness={0.55}
                    boil={0.35}
                    stroke="#ffffff"
                    width={2}
                    className="video-step__sketch-icon-btn"
                    onClick={handleRestart}
                    aria-label="Почати спочатку"
                    title="Спочатку"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </DrawablyButton>
                )}
              </div>

              <div className="video-step__header-right">
                {hasStarted && (
                  <>
                    <DrawablyButton
                      seed={7728194}
                      roughness={0.55}
                      boil={0.35}
                      stroke="#ffffff"
                      width={2}
                      className={`video-step__sketch-speed-btn ${
                        is2x ? 'video-step__sketch-speed-btn--active' : ''
                      }`}
                      onClick={handleToggleSpeedBtn}
                      aria-label={is2x ? 'Швидкість 1x' : 'Швидкість 2x'}
                      title={is2x ? 'Повернути 1x' : 'Прискорити 2x'}
                    >
                      {is2x ? '2x' : '1x'}
                    </DrawablyButton>

                    <DrawablyButton
                      seed={3391824}
                      roughness={0.55}
                      boil={0.35}
                      stroke="#ffffff"
                      width={2}
                      className="video-step__sketch-icon-btn"
                      onClick={handleToggleMute}
                      aria-label={isMuted ? 'Увімкнути звук' : 'Вимкнути звук'}
                      title={isMuted ? 'Увімкнути звук' : 'Вимкнути звук'}
                    >
                      {isMuted ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <line x1="23" y1="9" x2="17" y2="15" />
                          <line x1="17" y1="9" x2="23" y2="15" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        </svg>
                      )}
                    </DrawablyButton>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Initial Minimal Tap-to-Start Overlay: only Play button + "натисни" without background */}
        {!hasStarted && phase === 'idle' && (
          <button
            type="button"
            className="video-step__tap-overlay"
            onClick={(e) => {
              e.stopPropagation()
              handleInitialStart()
            }}
          >
            <SketchPlayCircle seed={210948902} size={76} />
            <span className="video-step__tap-text">натисни</span>
          </button>
        )}

        {/* Buffering Spinner */}
        {hasStarted && isBuffering && phase === 'playing' && (
          <div className="video-step__center-indicator" aria-live="polite">
            <div className="video-step__spinner" />
          </div>
        )}

        {/* Paused Overlay Indicator */}
        {hasStarted && phase === 'paused' && (
          <div className="video-step__center-indicator">
            <SketchPlayCircle seed={210948902} size={74} />
          </div>
        )}

        {/* Right-side 2x Playback Speed Feedback Indicator */}
        {hasStarted && speedToast && phase === 'playing' && (
          <div className="video-step__speed-toast" aria-live="polite">
            {speedToast}
          </div>
        )}

        {/* Video 4 (16:9 Demo) Rotate / Fullscreen Prompt & Scrub Bar */}
        {hasStarted && isLandscapeVideo && phase !== 'exited' && (
          <div
            className="video-step__demo-controls"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="video-step__demo-top-row">
              <DrawablyButton
                seed={210948902}
                roughness={0.6}
                boil={0.4}
                stroke="#ffffff"
                width={2}
                className="video-step__rotate-drawably-btn"
                onClick={handleToggleLandscape}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  {isLandscapeExpanded ? (
                    <>
                      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                    </>
                  ) : (
                    <>
                      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" transform="rotate(90 12 12)" />
                      <path d="M12 18h.01" />
                    </>
                  )}
                </svg>
                <span>
                  {isLandscapeExpanded
                    ? 'Згорнути екран'
                    : 'Поверни телефон або розгорни'}
                </span>
              </DrawablyButton>

              <DrawablyButton
                seed={88412094}
                roughness={0.6}
                boil={0.4}
                stroke="#ffffff"
                width={2}
                className="video-step__skip-drawably-btn"
                onClick={() => {
                  setIsLandscapeExpanded(false)
                  playVideoById('5', true)
                }}
              >
                <span>Далі</span>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </DrawablyButton>
            </div>

            <div className="video-step__scrub-row">
              <span className="video-step__time-label">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progress}
                onChange={handleSeek}
                className="video-step__scrub-slider"
                aria-label="Перемотка демо відео"
              />
              <span className="video-step__time-label">{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Minimal Choice Buttons at the End of Current Video (no background, no extra text/links) */}
        {phase === 'ended' && currentConfig.choices.length > 0 && (
          <div
            className="video-step__choices-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="video-step__choices-container">
              <div
                className={`video-step__choices-grid ${
                  currentConfig.choices.length === 2
                    ? 'video-step__choices-grid--two'
                    : 'video-step__choices-grid--one'
                }`}
              >
                {currentConfig.choices.map((choice) => (
                  <DrawablyButton
                    key={`${videoId}-${choice.id}`}
                    seed={choice.seed ?? 210948902}
                    roughness={0.6}
                    boil={0.4}
                    stroke="#ffffff"
                    width={2.2}
                    className="video-step__drawably-choice"
                    onClick={(e) => handleChoiceClick(choice, e)}
                  >
                    {choice.label}
                  </DrawablyButton>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Exit Screen (after clicking "ясно" on Video 3) */}
        {phase === 'exited' && (
          <div
            className="video-step__exit-screen"
            onClick={(e) => e.stopPropagation()}
          >
            <DrawablyCard
              seed={210948902}
              roughness={0.6}
              boil={0.4}
              stroke="#ffffff"
              width={2.2}
              className="video-step__exit-card"
            >
              <div className="video-step__exit-logo-wrap">
                <DrawablyCircle
                  seed={210948902}
                  roughness={0.6}
                  boil={0.4}
                  stroke="#ffffff"
                  width={2.2}
                  className="video-step__exit-logo"
                >
                  ₴
                </DrawablyCircle>
              </div>

              <h2 className="video-step__exit-title">
                <DrawablyUnderline
                  seed={210948902}
                  roughness={0.55}
                  boil={0.35}
                  stroke="#ffffff"
                  width={2}
                >
                  Дякуємо за час!
                </DrawablyUnderline>
              </h2>

              <p className="video-step__exit-text">
                Якщо захочеш автоматичний бюджет прямо з Monobank — Монета завжди під рукою.
              </p>

              <DrawablyDivider
                seed={210948902}
                roughness={0.5}
                boil={0.3}
                stroke="rgba(255, 255, 255, 0.35)"
                className="video-step__exit-divider"
              />

              <div className="video-step__exit-actions">
                <DrawablyButton
                  seed={210948902}
                  roughness={0.6}
                  boil={0.4}
                  stroke="#ffffff"
                  width={2.2}
                  className="video-step__drawably-choice"
                  onClick={() => {
                    window.location.href = MONETA_APP_URL
                  }}
                >
                  відкрити Монету
                </DrawablyButton>

                <DrawablyButton
                  seed={619482041}
                  roughness={0.6}
                  boil={0.4}
                  stroke="#ffffff"
                  width={2}
                  className="video-step__drawably-choice"
                  onClick={() => playVideoById('4', true)}
                >
                  всеодно подивитися демо
                </DrawablyButton>
              </div>
            </DrawablyCard>
          </div>
        )}
      </div>
    </div>
  )
}
