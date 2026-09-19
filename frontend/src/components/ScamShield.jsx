import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, MessageSquareWarning, AtSign, Smartphone, Phone, ExternalLink, CheckCircle2, XCircle, Info } from 'lucide-react'
import { useAdvisorStream } from '../hooks/useAdvisorStream'
import { useProfile } from '../context/ProfileContext'
import PipelineProgress from './trust/PipelineProgress'
import { useLanguage } from '../context/LanguageContext'
import ResultFooter from './trust/ResultFooter'

const TABS = [
  ['message', MessageSquareWarning],
  ['upi', AtSign],
  ['app', Smartphone],
]

// Sample texts stay in English: that is how these scams usually arrive, and what the red-flag rules match.
const SAMPLES = [
  ['tip', 'Join our SEBI-registered WhatsApp group for sure-shot multibagger tips. Guaranteed returns of 5% weekly! Limited slots, pay ₹4,999 today only to trader.profits@okaxis to activate your trading account.'],
  ['arrest', 'This is CBI officer calling. A money laundering case is registered on your Aadhaar. You are under digital arrest — do not tell your family. Transfer the verification amount immediately to avoid an arrest warrant.'],
  ['kyc', 'Dear customer, your KYC expired and your account will be blocked today. Share the OTP sent to your phone and install AnyDesk so our executive can update it.'],
]

const LEVEL = {
  HIGH: { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200', pct: 92 },
  MEDIUM: { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', pct: 58 },
  LOW: { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', pct: 18 },
}

const CHECK_ICON = { pass: [CheckCircle2, 'text-emerald-600'], fail: [XCircle, 'text-red-600'], warn: [XCircle, 'text-amber-600'], info: [Info, 'text-navy-900/40'] }

/** Message with every red-flag phrase highlighted, using the engine's character offsets. */
function Highlighted({ text, flags }) {
  const { p } = useLanguage()
  const parts = useMemo(() => {
    const spans = [...flags].sort((a, b) => a.start - b.start)
    const out = []
    let i = 0
    for (const f of spans) {
      if (f.start < i) continue
      if (f.start > i) out.push({ t: text.slice(i, f.start) })
      out.push({ t: text.slice(f.start, f.end), flag: f })
      i = f.end
    }
    if (i < text.length) out.push({ t: text.slice(i) })
    return out
  }, [text, flags])
  return (
    <p className="text-sm leading-relaxed text-navy-900/80 whitespace-pre-wrap">
      {parts.map((part, idx) => part.flag
        ? <mark key={idx} title={p(part.flag.label)} className="bg-red-100 text-red-800 rounded px-0.5 underline decoration-red-400 decoration-2 underline-offset-2">{part.t}</mark>
        : <span key={idx}>{part.t}</span>)}
    </p>
  )
}

export default function ScamShield() {
  const { restoreRequest, refresh } = useProfile()
  const { t, p } = useLanguage()
  const stream = useAdvisorStream('/api/scam-shield/stream')
  const [tab, setTab] = useState('message')
  const [message, setMessage] = useState('')
  const [upiId, setUpiId] = useState('')
  const [appName, setAppName] = useState('')
  const [error, setError] = useState(null)

  const { restore, status } = stream
  useEffect(() => {
    if (restoreRequest?.module === 'scam-shield') restore(restoreRequest.result)
  }, [restoreRequest, restore])
  useEffect(() => {
    if (status === 'done') refresh()
  }, [status, refresh])

  const check = () => {
    const body = tab === 'message' ? { message, upiId } : tab === 'upi' ? { upiId, message } : { appName }
    if (!body.message?.trim() && !body.upiId?.trim() && !body.appName?.trim()) {
      setError('scam.errEmpty')
      return
    }
    setError(null)
    stream.run(body)
  }

  const r = stream.data
  const pending = stream.running && !stream.result
  const level = r ? LEVEL[r.riskLevel] : null

  return (
    <section id="scam" className="py-20 relative scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="section-tag mx-auto mb-4"><ShieldAlert size={11} /> {t('scam.tag')}</div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-navy-900">{t('scam.title')} <span className="gradient-text">{t('scam.titleAccent')}</span></h2>
          <p className="mt-4 text-navy-900/50 max-w-2xl mx-auto">
            {t('scam.sub')}
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-5 items-start">
          <div className="lg:col-span-2 glass-card p-5 space-y-4">
            <div className="flex rounded-xl bg-navy-900/[0.04] p-1" role="tablist">
              {TABS.map(([key, Icon]) => (
                <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold ${tab === key ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-900/45'}`}>
                  <Icon size={12} /> <span className="hidden sm:inline">{t(`scam.tab.${key}`)}</span>
                </button>
              ))}
            </div>

            {tab === 'message' && (
              <>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} aria-label={t('scam.messageAria')}
                  placeholder={t('scam.placeholder')}
                  className="w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-3 py-2.5 text-sm text-navy-900 focus:outline-none focus:border-navy-900/30 resize-none" />
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40 self-center">{t('scam.try')}</span>
                  {SAMPLES.map(([id, text]) => (
                    <button key={id} onClick={() => setMessage(text)} className="text-[11px] px-2.5 py-1 rounded-full border border-navy-900/15 text-navy-900/65 hover:bg-navy-900/[0.04]">{t(`scam.sample.${id}`)}</button>
                  ))}
                </div>
              </>
            )}
            {tab === 'upi' && (
              <label className="block">
                <span className="text-[11px] font-semibold text-navy-900/50">{t('scam.upiLabel')}</span>
                <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder={t('common.eg', { v: 'abc.brk@validhdfc' })} className="mt-1 w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-3 py-2.5 text-sm font-mono text-navy-900 focus:outline-none focus:border-navy-900/30" />
                <span className="block text-[10px] text-navy-900/40 mt-1">{t('scam.upiHint')}</span>
              </label>
            )}
            {tab === 'app' && (
              <label className="block">
                <span className="text-[11px] font-semibold text-navy-900/50">{t('scam.appLabel')}</span>
                <input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder={t('common.eg', { v: 'QuickCash Loans' })} className="mt-1 w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-3 py-2.5 text-sm text-navy-900 focus:outline-none focus:border-navy-900/30" />
                <span className="block text-[10px] text-navy-900/40 mt-1">{t('scam.appHint')}</span>
              </label>
            )}

            <button onClick={check} disabled={stream.running} className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              <ShieldAlert size={14} /> {stream.running ? t('scam.checking') : t('scam.check')}
            </button>
            {error && <p className="text-xs text-red-500 text-center">{t(error)}</p>}
          </div>

          <div className="lg:col-span-3 space-y-4">
            {stream.status === 'idle' && (
              <div className="glass-card p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                <ShieldAlert size={32} className="text-navy-900/20 mb-3" />
                <p className="text-sm text-navy-900/45 max-w-sm">{t('scam.emptyHint')}</p>
              </div>
            )}
            {stream.status !== 'idle' && <PipelineProgress stages={stream.stages} status={stream.status} citations={stream.citations} trust={stream.result?.meta?.trust} />}
            {stream.status === 'error' && <div className="glass-card p-5 text-sm text-red-600 text-center">{t(stream.error)}</div>}

            <AnimatePresence>
              {r && level && (
                <motion.div key="res" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className={`rounded-2xl border p-5 ${level.bg}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-lg font-extrabold ${level.text}`}>{t(`scam.risk.${r.riskLevel}`)}</p>
                      <span className="text-[11px] font-mono text-navy-900/50">{t('scam.score', { n: r.riskScore })}</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white/70 overflow-hidden" role="meter" aria-valuenow={level.pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('scam.riskAria')}>
                      <motion.div className={`h-full ${level.bar}`} initial={{ width: 0 }} animate={{ width: `${level.pct}%` }} transition={{ duration: 0.6 }} />
                    </div>
                    <p className={`mt-3 text-sm text-navy-900/75 leading-relaxed ${pending ? 'animate-pulse' : ''}`}>{p(r.verdict)}</p>
                  </div>

                  {r.message && (
                    <div className="glass-card p-5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40 mb-2">{t('scam.yourMessage')}</p>
                      <Highlighted text={r.message} flags={r.flags || []} />
                    </div>
                  )}

                  {r.categories?.length > 0 && (
                    <div className="glass-card p-5 space-y-2.5">
                      <p className="text-sm font-bold text-navy-900">{t('scam.why')}</p>
                      {r.categories.map((c) => (
                        <div key={c.category} className="p-3 rounded-xl bg-red-50/50 border border-red-100">
                          <p className="text-xs font-bold text-red-800">{p(c.label)}</p>
                          <p className={`text-xs text-navy-900/65 mt-0.5 ${pending ? 'animate-pulse' : ''}`}>{p(c.explanation)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.checks?.length > 0 && (
                    <div className="glass-card p-5 space-y-2">
                      <p className="text-sm font-bold text-navy-900">{t('scam.checks')}</p>
                      {r.checks.map((c) => {
                        const [Icon, color] = CHECK_ICON[c.status] || CHECK_ICON.info
                        return (
                          <div key={c.key} className="flex items-start gap-2">
                            <Icon size={15} className={`${color} flex-shrink-0 mt-0.5`} />
                            <div><p className="text-xs font-semibold text-navy-900">{p(c.label)}</p><p className="text-[11px] text-navy-900/55">{p(c.detail)}</p></div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-2">
                    {(r.helplines || []).map((h) => (
                      <a key={h.url} href={h.url} target={h.url.startsWith('tel:') ? undefined : '_blank'} rel="noreferrer"
                        className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white border border-navy-900/10 text-xs font-semibold text-navy-900 hover:border-navy-900/30">
                        <span className="flex items-center gap-2">{h.url.startsWith('tel:') ? <Phone size={13} /> : <ExternalLink size={13} />} {p(h.label)}</span>
                      </a>
                    ))}
                  </div>

                  <ResultFooter meta={r.meta} citations={stream.citations} pending={pending} module="scam-shield"
                    askContext={`Scam check: ${r.riskLevel} risk; flags: ${(r.categories || []).map((c) => c.label).join(', ')}`}
                    suggestions={[t('scam.ask.1'), t('scam.ask.2')]} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
