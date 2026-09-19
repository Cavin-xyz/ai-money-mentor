import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, User, Sparkles, UploadCloud, Calculator, Loader2, Trophy, PencilLine, FileCheck2, X, ShieldCheck } from 'lucide-react'
import { postForm, postJson, streamSse } from '../lib/api'
import { formatINR } from '../lib/format'
import { useProfile } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'
import AnswerWithCitations from './trust/AnswerWithCitations'
import SourceChips from './trust/SourceChips'
import ExplainPanel from './trust/ExplainPanel'
import { TrustBadge, Disclaimer } from './trust/Badges'

const TAX_YEARS = [
  { key: '2026-27', label: 'sources.ty' },
  { key: '2025-26', label: 'tax.fy' },
]

const FIELDS = [
  ['grossSalary', 'tax.f.gross', true],
  ['basicSalary', 'tax.f.basic', false],
  ['hraReceived', 'tax.f.hra', false],
  ['rentPaid', 'tax.f.rent', false],
  ['sec80C', 'tax.f.80c', false],
  ['sec80D', 'tax.f.80d', false],
  ['sec80CCD1B', 'tax.f.nps', false],
  ['employerNps', 'tax.f.empNps', false],
  ['homeLoanInterest', 'tax.f.homeLoan', false],
]

const inputClass = 'w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-lg px-3 py-2 text-sm text-navy-900 font-mono font-semibold focus:outline-none focus:border-navy-900/30 placeholder-navy-900/25'

function Row({ label, a, b, strong }) {
  return (
    <div className={`grid grid-cols-[1fr_auto_auto] gap-3 py-1.5 border-b border-navy-900/[0.05] last:border-0 text-xs ${strong ? 'font-bold text-navy-900' : 'text-navy-900/60'}`}>
      <span>{label}</span>
      <span className="font-mono text-right w-24">{a}</span>
      <span className="font-mono text-right w-24">{b}</span>
    </div>
  )
}

function RegimeCard({ taxYear, inputs, setInputs, result, setResult }) {
  const { t, p } = useLanguage()
  const [editing, setEditing] = useState(!result)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [form16, setForm16] = useState(null)
  const [reading, setReading] = useState(false)
  const fileRef = useRef(null)

  const compare = async (values = inputs) => {
    if (!Number(values.grossSalary)) {
      setError('tax.card.errGross')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await postJson('/api/tax/compare', { ...values, taxYear })
      setResult(r)
      setEditing(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (result && result.taxYear !== taxYear && Number(inputs.grossSalary)) {
      postJson('/api/tax/compare', { ...inputs, taxYear }).then(setResult).catch(() => {})
    }
  }, [taxYear]) // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setReading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await postForm('/api/documents/form16', fd)
      const f = r.form16 || {}
      setForm16({
        employer: f.employer, financialYear: f.financialYear, tds: f.tdsDeducted,
        values: Object.fromEntries(FIELDS.map(([k]) => [k, f[k] ?? ''])),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setReading(false)
    }
  }

  const useForm16 = () => {
    const values = { ...inputs, ...Object.fromEntries(Object.entries(form16.values).map(([k, v]) => [k, v === null ? '' : `${v}`])) }
    setInputs(values)
    setForm16(null)
    compare(values)
  }

  const o = result?.oldRegime
  const n = result?.newRegime
  const winnerLabel = t(result?.winner === 'new' ? 'tax.new' : result?.winner === 'old' ? 'tax.old' : 'tax.equal')

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center"><Calculator size={15} className="text-amber-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-navy-900">{t('tax.card.title')}</h3>
            <p className="text-[11px] text-navy-900/45">{t('tax.card.sub')}</p>
          </div>
        </div>
        {result && !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-[11px] font-semibold text-navy-900/50 hover:text-navy-900"><PencilLine size={12} /> {t('common.edit')}</button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} />

      {form16 ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div>
              <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5"><FileCheck2 size={13} /> {t('tax.card.form16Read')}</p>
              <p className="text-[11px] text-emerald-700/80">{form16.employer || t('tax.card.noEmployer')}{form16.financialYear ? ` · ${t('tax.fy', { year: form16.financialYear })}` : ''}{form16.tds ? ` · TDS ${formatINR(form16.tds)}` : ''}</p>
              <p className="text-[10px] text-emerald-700/60 mt-1">{t('tax.card.form16Note')}</p>
            </div>
            <button onClick={() => setForm16(null)} className="p-1 text-emerald-700/60 hover:text-emerald-800" aria-label={t('tax.card.discard')}><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(([k, label]) => (
              <label key={k} className="block">
                <span className="block text-[10px] font-semibold text-navy-900/45 mb-0.5">{t(label)}</span>
                <input className={inputClass} value={form16.values[k] ?? ''} onChange={(e) => setForm16((f) => ({ ...f, values: { ...f.values, [k]: e.target.value } }))} />
              </label>
            ))}
          </div>
          <button onClick={useForm16} className="btn-primary w-full text-xs">{t('tax.card.useNumbers')}</button>
        </div>
      ) : editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(([k, label, req]) => (
              <label key={k} className={`block ${k === 'grossSalary' ? 'col-span-2' : ''}`}>
                <span className="block text-[10px] font-semibold text-navy-900/45 mb-0.5">{t(label)}{req ? ' *' : ''}</span>
                <input className={inputClass} inputMode="numeric" placeholder={req ? t('common.eg', { v: 1800000 }) : '0'} value={inputs[k] ?? ''} onChange={(e) => setInputs((v) => ({ ...v, [k]: e.target.value }))} />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => compare()} disabled={busy} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />} {t('tax.card.compare')}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={reading} className="btn-ghost text-xs flex items-center gap-1.5">
              {reading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} {t('tax.card.form16')}
            </button>
          </div>
          {reading && <p className="text-[11px] text-navy-900/50">{t('tax.card.reading')}</p>}
        </div>
      ) : result && (
        <div className="space-y-4">
          <div className={`p-3 rounded-xl border text-center ${result.winner === 'equal' ? 'bg-navy-900/[0.03] border-navy-900/10' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center justify-center gap-1"><Trophy size={12} /> {t('tax.card.better')}</p>
            <p className="text-lg font-extrabold text-navy-900">{winnerLabel}</p>
            {result.savings > 0 && <p className="text-xs text-emerald-700 font-semibold">{t('tax.card.save', { amount: formatINR(result.savings) })}</p>}
            <p className="text-[10px] text-navy-900/40 mt-0.5">{p(result.taxYearLabel)} · {p(result.act)}</p>
          </div>
          <div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-navy-900/40">
              <span />
              <span className="w-24 text-right">{t('tax.col.old')}</span>
              <span className="w-24 text-right">{t('tax.col.new')}</span>
            </div>
            <Row label={t('tax.row.gross')} a={formatINR(o.grossIncome)} b={formatINR(n.grossIncome)} />
            <Row label={t('tax.row.deductions')} a={formatINR(o.totalDeductions)} b={formatINR(n.totalDeductions)} />
            <Row label={t('tax.row.taxable')} a={formatINR(o.taxableIncome)} b={formatINR(n.taxableIncome)} />
            <Row label={t('tax.row.slabs')} a={formatINR(o.slabTax)} b={formatINR(n.slabTax)} />
            <Row label={t('tax.row.rebate')} a={`−${formatINR(o.rebate + o.marginalRelief)}`} b={`−${formatINR(n.rebate + n.marginalRelief)}`} />
            <Row label={t('tax.row.cess')} a={formatINR(o.cess)} b={formatINR(n.cess)} />
            <Row label={t('tax.row.total')} a={formatINR(o.totalTax)} b={formatINR(n.totalTax)} strong />
          </div>
          {result.gaps?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40">{t('tax.card.gaps')}</p>
              {result.gaps.map((g) => (
                <div key={g.key} className="flex items-center justify-between text-xs p-2 rounded-lg bg-navy-900/[0.02] border border-navy-900/[0.05]">
                  <span className="text-navy-900/70">{g.section} <span className="text-navy-900/40">· {t('tax.card.unused', { amount: formatINR(g.headroom) })}</span></span>
                  <span className="font-semibold text-emerald-700">{t('tax.card.saves', { amount: formatINR(g.oldRegimeSaving) })}</span>
                </div>
              ))}
              {result.breakEvenExtraDeductions > 0 && (
                <p className="text-[11px] text-navy-900/50">{t('tax.card.breakEven', { amount: formatINR(result.breakEvenExtraDeductions) })}</p>
              )}
            </div>
          )}
          <ExplainPanel calculations={result.calculations} assumptions={result.assumptions} />
        </div>
      )}
      {error && <p className="text-xs text-red-500">{t(error)}</p>}
    </div>
  )
}

export default function TaxWizard() {
  const { refresh } = useProfile()
  const { lang, t } = useLanguage()
  const [taxYear, setTaxYear] = useState('2026-27')
  const [inputs, setInputs] = useState({})
  const [comparison, setComparison] = useState(null)
  // The greeting is rendered from i18n so it follows the language; it is not sent as history.
  const [messages, setMessages] = useState([{ role: 'assistant', greeting: true, text: '' }])
  const [inputValue, setInputValue] = useState('')
  const [busy, setBusy] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const updateLast = (fn) => setMessages((m) => {
    const copy = [...m]
    copy[copy.length - 1] = fn(copy[copy.length - 1])
    return copy
  })

  const send = async (text) => {
    const q = (text ?? inputValue).trim()
    if (!q || busy) return
    const history = [...messages, { role: 'user', text: q }]
    setMessages([...history, { role: 'assistant', text: '', streaming: true, citations: [] }])
    setInputValue('')
    setBusy(true)
    try {
      const taxInputs = comparison ? inputs : undefined
      await streamSse('/api/tax/wizard/stream', { history: history.filter((m) => !m.greeting).map(({ role, text }) => ({ role, text })), taxInputs, taxYear }, {
        token: (d) => updateLast((m) => ({ ...m, text: m.text + d.t })),
        sources: (d) => updateLast((m) => ({ ...m, citations: d.citations || [] })),
        result: (d) => updateLast((m) => ({ ...m, text: d.answer, trust: d.trust, streaming: false })),
        error: (d) => updateLast((m) => ({ ...m, text: d.message, streaming: false, error: true })),
      })
    } catch (e) {
      updateLast((m) => ({ ...m, text: e.message, streaming: false, error: true }))
    } finally {
      updateLast((m) => ({ ...m, streaming: false }))
      setBusy(false)
      refresh()
    }
  }

  return (
    <section id="tax" className="py-24 relative overflow-hidden scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-8">
          <div className="section-tag mx-auto mb-4"><Sparkles size={11} /> {t('tax.tag')}</div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-navy-900 mb-4">
            {t('tax.title')} <span className="gradient-text">{t('tax.titleAccent')}</span>
          </h2>
          <p className="text-navy-900/55 text-lg max-w-2xl mx-auto">
            {t('tax.sub')}
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <div role="radiogroup" aria-label={t('tax.yearAria')} className="inline-flex p-1 rounded-xl bg-navy-900/[0.05] border border-navy-900/10">
            {TAX_YEARS.map((y) => (
              <button
                key={y.key}
                role="radio"
                aria-checked={taxYear === y.key}
                onClick={() => setTaxYear(y.key)}
                className={`px-4 py-2 rounded-lg text-left transition-all ${taxYear === y.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              >
                <span className="block text-xs font-bold text-navy-900">{t(y.label, { year: y.key })}</span>
                <span className="block text-[10px] text-navy-900/45">{t(`tax.year.${y.key}.sub`)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-5 items-start">
          {/* Chat */}
          <div className="lg:col-span-3 glass-card border border-navy-900/10 rounded-2xl overflow-hidden flex flex-col h-[640px] shadow-lg">
            <div className="bg-navy-900/[0.03] border-b border-navy-900/[0.08] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-navy-900/[0.08] flex items-center justify-center border border-navy-900/10">
                  <Sparkles size={20} className="text-navy-900/60" />
                </div>
                <div>
                  <h3 className="text-navy-900 font-bold text-sm">{t('tax.chat.name')}</h3>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {t(comparison ? 'tax.chat.withNumbers' : 'tax.chat.general')}
                  </p>
                </div>
              </div>
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-cream/50">
              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 max-w-[92%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 border bg-navy-900/[0.06] border-navy-900/10">
                      {msg.role === 'user' ? <User size={14} className="text-navy-900/60" /> : <Sparkles size={14} className="text-navy-900/60" />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed min-w-0 ${msg.role === 'user'
                      ? 'bg-navy-900 text-white rounded-tr-none whitespace-pre-wrap'
                      : `bg-white border rounded-tl-none space-y-3 ${msg.error ? 'border-red-200 text-red-600' : 'border-navy-900/[0.08]'}`}`}>
                      {msg.role === 'user' ? msg.text : msg.greeting ? t('tax.chat.greeting') : msg.error ? t(msg.text) : (
                        <>
                          {msg.text ? <AnswerWithCitations text={msg.text} citations={msg.citations} streaming={msg.streaming} lang={lang} />
                            : <span className="flex items-center gap-2 text-navy-900/40 text-xs"><Loader2 size={12} className="animate-spin" /> {t('tax.chat.searching')}</span>}
                          {!msg.streaming && msg.trust && <TrustBadge trust={msg.trust} compact />}
                          {msg.citations?.length > 0 && <SourceChips citations={msg.citations} compact />}
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="p-4 bg-white border-t border-navy-900/[0.08]">
              {messages.length <= 2 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {[t('tax.suggest.1'), t('tax.suggest.2'), t('tax.suggest.3')].map((s) => (
                    <button key={s} onClick={() => send(s)} disabled={busy} className="flex-shrink-0 px-3 py-1.5 rounded-full border border-navy-900/15 bg-navy-900/[0.04] text-navy-900/60 text-xs hover:bg-navy-900/[0.08] transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative flex items-end">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder={t('tax.chat.placeholder')}
                  aria-label={t('tax.chat.placeholder')}
                  className="w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-3 pr-12 text-sm text-navy-900 placeholder-navy-900/30 focus:outline-none focus:border-navy-900/30 focus:ring-1 focus:ring-navy-900/20 resize-none max-h-32 min-h-[50px]"
                  rows={1}
                />
                <button onClick={() => send()} disabled={!inputValue.trim() || busy} className="absolute right-2 bottom-2 p-2 rounded-lg bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50" aria-label={t('tax.chat.send')}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-navy-900/35 text-center mt-3 flex items-center justify-center gap-1">
                <ShieldCheck size={11} /> {t('tax.chat.footer')}
              </p>
            </div>
          </div>

          {/* Regime comparison */}
          <div className="lg:col-span-2 space-y-3">
            <RegimeCard taxYear={taxYear} inputs={inputs} setInputs={setInputs} result={comparison} setResult={setComparison} />
            <Disclaimer />
          </div>
        </div>
      </div>
    </section>
  )
}
