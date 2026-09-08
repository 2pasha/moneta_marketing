import { useState } from 'react'
import VideoOnboardingStep from './components/VideoOnboardingStep.jsx'

function App() {
  const [step, setStep] = useState(0)

  if (step === 0) {
    return <VideoOnboardingStep onComplete={() => setStep(1)} />
  }

  return <div className="step-placeholder">Step 2 placeholder</div>
}

export default App
