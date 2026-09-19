import { useState } from 'react'
import { UserRound, X } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'

const KEY = 'mm.bannerDismissed'

function dismissedBefore() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** First-visit nudge to create a local profile; remembered once dismissed. */
export default function ProfileBanner() {
  const { hasProfile, openDrawer } = useProfile()
  const [dismissed, setDismissed] = useState(dismissedBefore)
  if (hasProfile || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* private mode */
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <div className="glass-card px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-navy-900/[0.05] border border-navy-900/10 flex items-center justify-center flex-shrink-0"><UserRound size={16} className="text-navy-900/60" /></span>
        <p className="flex-1 text-sm text-navy-900/70">
          <strong className="text-navy-900">Save your numbers once and every tool pre-fills.</strong> Your profile stays in a file on this device.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => openDrawer('profile')} className="btn-primary !py-2 text-xs">Create profile</button>
          <button onClick={dismiss} className="btn-ghost !py-2 text-xs">Not now</button>
          <button onClick={dismiss} className="p-1.5 text-navy-900/35 hover:text-navy-900 sm:hidden" aria-label="Dismiss"><X size={14} /></button>
        </div>
      </div>
    </div>
  )
}
