import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircleQuestion, Send, Loader2 } from 'lucide-react'
import { streamSse } from '../../lib/api'
import AnswerWithCitations from './AnswerWithCitations'
import SourceChips from './SourceChips'
import { TrustBadge } from './Badges'
import { useProfile } from '../../context/ProfileContext'

/** "Ask about this" — a follow-up question answered from official sources, with this result as context. */
export default function AskBox({ module, context, suggestions = [] }) {
  const { prefs } = useProfile() || {}
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState([])
  const [trust, setTrust] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const ctrl = useRef(null)

  const ask = async (question) => {
    const text = (question ?? q).trim()
    if (!text || busy) return
    ctrl.current?.abort()
    ctrl.current = new AbortController()
    setQ(text)
    setAnswer('')
    setCitations([])
    setTrust(null)
    setError(null)
    setBusy(true)
    try {
      await streamSse('/api/knowledge/ask/stream', { question: text, module, context }, {
        token: (d) => setAnswer((a) => a + d.t),
        sources: (d) => setCitations(d.citations || []),
        result: (d) => { setAnswer(d.answer); setTrust(d.trust) },
        error: (d) => setError(d.message),
      }, { signal: ctrl.current.signal })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-5 py-3.5 text-left hover:bg-navy-900/[0.02] transition-colors"
      >
        <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
          <MessageCircleQuestion size={14} className="text-blue-600" />
        </span>
        <span className="text-sm font-bold text-navy-900">Ask about this</span>
        <span className="text-[11px] text-navy-900/40 hidden sm:inline">answered from official sources on this device</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-navy-900/[0.06]">
            <div className="p-5 space-y-3">
              {suggestions.length > 0 && !answer && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="text-[11px] px-3 py-1.5 rounded-full border border-navy-900/15 text-navy-900/65 hover:bg-navy-900/[0.04]">{s}</button>
                  ))}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); ask() }} className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="e.g. Can I claim 80C under the new regime?"
                  className="flex-1 min-w-0 bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-2.5 text-sm text-navy-900 placeholder-navy-900/30 focus:outline-none focus:border-navy-900/30"
                  aria-label="Your question"
                />
                <button type="submit" disabled={busy || !q.trim()} className="btn-primary px-4 disabled:opacity-40" aria-label="Ask">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </form>
              {(answer || busy) && (
                <div className="p-4 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06] space-y-3">
                  {answer ? <AnswerWithCitations text={answer} citations={citations} streaming={busy} lang={prefs?.language} />
                    : <p className="text-xs text-navy-900/40 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Searching official sources…</p>}
                  {!busy && (
                    <div className="flex flex-wrap items-start gap-2">
                      <TrustBadge trust={trust} compact />
                    </div>
                  )}
                  <SourceChips citations={citations} compact={busy} />
                </div>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
