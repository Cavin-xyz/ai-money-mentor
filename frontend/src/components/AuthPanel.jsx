import { useState } from 'react'
import { KeyRound, Loader2, LogIn, UserPlus } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'

const input = 'w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:border-navy-900/30'

/**
 * Sign in or create an account. The passphrase is sent once and never stored in the browser —
 * the backend replies with an HttpOnly session cookie the page itself cannot read.
 */
export default function AuthPanel({ onGuest }) {
  const { auth, login, createAccount } = useProfile()
  const { t } = useLanguage()
  const [mode, setMode] = useState('signIn')
  const [username, setUsername] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !passphrase) {
      setError('auth.err.empty')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signIn') await login(username.trim(), passphrase)
      else await createAccount(username.trim(), passphrase)
      setPassphrase('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-base font-bold text-navy-900">{t('auth.title')}</p>
        <p className="mt-1 text-sm text-navy-900/55">{t(auth.required ? 'auth.subRequired' : 'auth.sub')}</p>
      </div>

      <div className="flex rounded-xl bg-navy-900/[0.04] p-1" role="tablist">
        {[['signIn', LogIn], ['register', UserPlus]].map(([m, Icon]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => { setMode(m); setError(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-900/45 hover:text-navy-900/70'}`}
          >
            <Icon size={13} /> {t(m === 'signIn' ? 'auth.tab.signIn' : 'auth.tab.register')}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-[11px] font-semibold text-navy-900/50 mb-1">{t('auth.username')}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={input}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
          />
          {mode === 'register' && <span className="mt-1 block text-[10px] text-navy-900/40">{t('auth.usernameHint')}</span>}
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-navy-900/50 mb-1">{t('auth.passphrase')}</span>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className={input}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          />
          {mode === 'register' && <span className="mt-1 block text-[10px] text-navy-900/40">{t('auth.passphraseHint')}</span>}
        </label>

        {error && <p className="text-xs text-red-500">{t(error)}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
          {t(mode === 'signIn' ? 'auth.signIn' : 'auth.createAccount')}
        </button>
      </form>

      {mode === 'register' && <p className="text-[11px] text-navy-900/45">{t('auth.keepsGuestData')}</p>}

      {!auth.required && (
        <div className="pt-3 border-t border-navy-900/[0.08] space-y-1.5">
          <button onClick={onGuest} className="text-xs font-semibold text-blue-600 hover:underline">{t('auth.guest')}</button>
          <p className="text-[11px] text-navy-900/45">{t('auth.guestNote')}</p>
        </div>
      )}
    </div>
  )
}
