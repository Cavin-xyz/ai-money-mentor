import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  ScanSearch, Upload, FileText, X, Plus, Trash2, Lock, TrendingUp, PieChart, BarChart3, AlertTriangle,
  ArrowRightLeft, IndianRupee, Heart, Zap, Layers, Target, ShieldCheck, CalendarClock, Coins,
} from 'lucide-react'
import { getJson } from '../lib/api'
import { useAdvisorStream } from '../hooks/useAdvisorStream'
import { useProfile } from '../context/ProfileContext'
import PipelineProgress from './trust/PipelineProgress'
import { useLanguage } from '../context/LanguageContext'
import ResultFooter from './trust/ResultFooter'

const anim = (i) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.04 * i, duration: 0.3 } })

const priorityColor = {
  Critical: 'bg-red-50 text-red-600 border-red-100',
  High: 'bg-orange-50 text-orange-600 border-orange-100',
  Medium: 'bg-amber-50 text-amber-600 border-amber-100',
}
const ratingColor = { Good: 'bg-emerald-50 text-emerald-600', Average: 'bg-amber-50 text-amber-600', Poor: 'bg-red-50 text-red-600' }
const barColors = ['bg-navy-900', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-slate-400']

let rowId = 0
const newRow = () => ({ id: ++rowId, name: '', value: '', amfi: '' })

/** One manual holding row with AMFI scheme-name autocomplete. */
function FundRow({ row, onChange, onRemove, canRemove }) {
  const { t, p } = useLanguage()
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  const search = (q) => {
    onChange({ ...row, name: q, amfi: '' })
    clearTimeout(timer.current)
    if (q.trim().length < 3) {
      setSuggestions([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        setSuggestions(await getJson(`/api/portfolio/schemes?q=${encodeURIComponent(q)}`))
        setOpen(true)
      } catch {
        setSuggestions([])
      }
    }, 250)
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="relative flex-1 min-w-0">
        <input
          value={row.name}
          onChange={(e) => search(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t('xray.fundName')}
          aria-label={t('xray.fundName')}
          className="w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-3 py-2.5 text-sm text-navy-900 focus:outline-none focus:border-navy-900/30"
        />
        {row.amfi && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">AMFI ✓</span>}
        {open && suggestions.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-navy-900/10 rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {suggestions.map((s) => (
              <li key={s.code}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange({ ...row, name: s.name, amfi: s.code }); setOpen(false) }}
                  className="w-full text-left px-3 py-2 hover:bg-navy-900/[0.04]"
                >
                  <p className="text-xs font-semibold text-navy-900 leading-snug">{s.name}</p>
                  <p className="text-[10px] text-navy-900/45">{p(s.plan)} · {p(s.category)} · NAV ₹{s.nav} ({s.navDate})</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="w-36 flex items-center bg-navy-900/[0.03] border border-navy-900/10 rounded-xl overflow-hidden">
        <span className="pl-3 text-sm text-navy-900/40 font-mono">₹</span>
        <input value={row.value} onChange={(e) => onChange({ ...row, value: e.target.value })} inputMode="numeric" placeholder={t('xray.value')} aria-label={t('xray.currentValue')} className="w-full bg-transparent px-2 py-2.5 text-sm font-mono font-bold text-navy-900 focus:outline-none" />
      </div>
      <button onClick={onRemove} disabled={!canRemove} className="p-2.5 rounded-xl text-navy-900/35 hover:text-red-500 hover:bg-red-50 disabled:opacity-20" aria-label={t('xray.removeFund')}><Trash2 size={15} /></button>
    </div>
  )
}

export default function PortfolioXRay() {
  const ref = useRef(null)
  const fileInputRef = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const { restoreRequest, refresh } = useProfile()
  const { t, p } = useLanguage()
  const stream = useAdvisorStream('/api/portfolio/stream')

  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [rows, setRows] = useState(() => [newRow(), newRow(), newRow()])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const { restore, status } = stream
  useEffect(() => {
    if (restoreRequest?.module === 'portfolio') {
      restore(restoreRequest.result)
      document.getElementById('xray')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [restoreRequest, restore])
  useEffect(() => {
    if (status === 'done') refresh()
  }, [status, refresh])

  const pickFile = (f) => {
    if (!f) return
    const ok = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(f.type)
    if (!ok) return setError('xray.err.type')
    if (f.size > 20 * 1024 * 1024) return setError('xray.err.size')
    setError(null)
    setFile(f)
  }

  const analyze = () => {
    const fd = new FormData()
    if (mode === 'file') {
      if (!file) return setError('xray.err.noFile')
      fd.append('file', file)
      if (password) fd.append('password', password)
    } else {
      const holdings = rows.filter((r) => r.name.trim() && Number(String(r.value).replace(/[,\s₹]/g, '')) > 0)
        .map((r) => ({ name: r.name.trim(), value: Number(String(r.value).replace(/[,\s₹]/g, '')), amfi: r.amfi }))
      if (!holdings.length) return setError('xray.err.noFunds')
      fd.append('holdings', JSON.stringify(holdings))
    }
    setError(null)
    stream.run(fd)
  }

  const reset = () => {
    stream.reset()
    setFile(null)
    setPassword('')
  }

  const plan = stream.data
  const pending = stream.running && !stream.result
  const showResults = stream.status !== 'idle'

  return (
    <section id="xray" className="py-24 relative overflow-hidden scroll-mt-20">
      <div className="absolute inset-0 grid-dot-bg opacity-20 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="text-center mb-14">
          <div className="section-tag mx-auto mb-4"><ScanSearch size={11} /> {t('xray.tag')}</div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-navy-900">{t('xray.title')} <span className="gradient-text">{t('xray.titleAccent')}</span></h2>
          <p className="mt-4 text-navy-900/50 max-w-2xl mx-auto text-base leading-relaxed">
            {t('xray.sub')}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!showResults && (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="glass-card p-6 sm:p-8 max-w-2xl mx-auto">
                <div className="flex rounded-xl bg-navy-900/[0.04] p-1 mb-6" role="tablist">
                  {[['file', Upload, 'xray.mode.file'], ['manual', FileText, 'xray.mode.manual']].map(([m, Icon, l]) => (
                    <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-900/40 hover:text-navy-900/60'}`}>
                      <Icon size={13} /> {t(l)}
                    </button>
                  ))}
                </div>

                {mode === 'file' ? (
                  <div className="space-y-4">
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all ${dragging ? 'border-navy-900/40 bg-navy-900/[0.06]' : file ? 'border-emerald-300 bg-emerald-50/50' : 'border-navy-900/15 hover:border-navy-900/30 hover:bg-navy-900/[0.02]'}`}
                    >
                      <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickFile(e.target.files[0])} />
                      {file ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center"><ShieldCheck size={22} className="text-emerald-600" /></div>
                          <div>
                            <p className="text-sm font-bold text-navy-900">{file.name}</p>
                            <p className="text-xs text-emerald-600 font-medium">{t(file.type.startsWith('image/') ? 'xray.shot' : 'xray.cas')}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setFile(null) }} className="text-xs text-navy-900/40 hover:text-red-500 flex items-center gap-1"><X size={12} /> {t('xray.remove')}</button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-navy-900/[0.06] border border-navy-900/10 flex items-center justify-center"><Upload size={24} className="text-navy-900/50" /></div>
                          <div>
                            <p className="text-sm font-bold text-navy-900 mb-1">{t('xray.drop')}</p>
                            <p className="text-xs text-navy-900/40">{t('xray.dropHint')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {file && file.type === 'application/pdf' && (
                      <label className="block">
                        <span className="text-[11px] font-semibold text-navy-900/50 flex items-center gap-1.5"><Lock size={11} /> {t('xray.password')}</span>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className="mt-1 w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-3 py-2.5 text-sm text-navy-900 focus:outline-none focus:border-navy-900/30" />
                        <span className="text-[10px] text-navy-900/40">{t('xray.passwordNote')}</span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {rows.map((r) => (
                      <FundRow key={r.id} row={r} canRemove={rows.length > 1}
                        onChange={(nr) => setRows((rs) => rs.map((x) => (x.id === r.id ? nr : x)))}
                        onRemove={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
                    ))}
                    <button onClick={() => setRows((rs) => [...rs, newRow()])} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-navy-900/20 text-xs text-navy-900/60 hover:bg-navy-900/[0.03]">
                      <Plus size={13} /> {t('xray.addFund')}
                    </button>
                    <p className="text-[10px] text-navy-900/40">{t('xray.manualNote')}</p>
                  </div>
                )}

                <button onClick={analyze} className="btn-primary w-full flex items-center justify-center gap-2 text-sm mt-5"><ScanSearch size={14} /> {t('xray.run')}</button>
                {error && <p className="mt-3 text-xs text-red-500 text-center">{t(error)}</p>}
              </div>
            </motion.div>
          )}

          {showResults && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <PipelineProgress withParse stages={stream.stages} status={stream.status} citations={stream.citations} trust={stream.result?.meta?.trust} />
              {stream.status === 'error' && (
                <div className="glass-card p-5 text-center">
                  <p className="text-sm text-red-600">{t(stream.error)}</p>
                  <button onClick={reset} className="btn-ghost mt-3 text-xs">{t('common.tryAgain')}</button>
                </div>
              )}

              {plan && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-800"><CalendarClock size={12} /> {t('xray.navAsOf', { date: plan.navDate })}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-navy-900/[0.04] border border-navy-900/10 text-navy-900/60">{t(plan.source === 'statement' ? 'xray.src.statement' : plan.source === 'screenshot' ? 'xray.src.screenshot' : 'xray.src.manual')}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-navy-900/[0.04] border border-navy-900/10 text-navy-900/60">{t('xray.overlapEstimated')}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'value', label: t('xray.tile.value'), value: plan.portfolioValue, icon: <IndianRupee size={14} className="text-emerald-500" /> },
                      { id: 'xirr', label: t('xray.tile.xirr'), value: plan.estimatedXIRR, icon: <TrendingUp size={14} className="text-cyan-600" />, note: plan.estimatedXIRR === 'n/a' ? t('xray.needsTx') : null },
                      { id: 'health', label: t('xray.tile.health'), value: plan.healthScore, icon: <Heart size={14} className="text-rose-500" /> },
                      { id: 'drag', label: t('xray.tile.drag'), value: plan.expenseDrag, icon: <Zap size={14} className="text-amber-500" /> },
                    ].map((s, i) => (
                      <motion.div key={s.id} {...anim(i)} className="glass-card p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">{s.icon}<span className="text-[9px] font-bold text-navy-900/40 uppercase tracking-wider">{s.label}</span></div>
                        <p className="text-lg font-extrabold text-navy-900 leading-tight">{s.value}</p>
                        {s.note && <p className="text-[10px] text-navy-900/40">{s.note}</p>}
                      </motion.div>
                    ))}
                  </div>

                  {plan.directVsRegular && plan.annualSavings !== '₹0' && (
                    <motion.div {...anim(4)} className="glass-card p-5 flex flex-wrap items-center gap-4 justify-between border-amber-200">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center"><Coins size={16} className="text-amber-600" /></div>
                        <div>
                          <p className="text-sm font-bold text-navy-900">{t('xray.dvr.title')}</p>
                          <p className="text-[11px] text-navy-900/50">{t('xray.dvr.sub')}</p>
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-right"><p className="text-[10px] text-navy-900/40 uppercase tracking-wider font-bold">{t('xray.dvr.year')}</p><p className="text-lg font-extrabold text-amber-700 font-mono">{plan.directVsRegular.extraPerYear}</p></div>
                        <div className="text-right"><p className="text-[10px] text-navy-900/40 uppercase tracking-wider font-bold">{t('xray.dvr.ten')}</p><p className="text-lg font-extrabold text-red-600 font-mono">{plan.directVsRegular.tenYearCost}</p></div>
                      </div>
                    </motion.div>
                  )}

                  {plan.allocation?.length > 0 && (
                    <motion.div {...anim(5)} className="glass-card p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center"><PieChart size={14} className="text-blue-500" /></div>
                          <h3 className="text-sm font-bold text-navy-900">{t('xray.alloc')}</h3>
                        </div>
                        {plan.targetEquityPct !== undefined && <span className="text-[10px] text-navy-900/45">{t('xray.target', { t: plan.targetEquityPct, d: `${plan.equityDrift > 0 ? '+' : ''}${plan.equityDrift}` })}</span>}
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden mb-4">
                        {plan.allocation.map((a, i) => <div key={a.category} className={`${barColors[i % barColors.length]}`} style={{ width: a.percentage }} title={`${p(a.category)} ${a.percentage}`} />)}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {plan.allocation.map((a, i) => (
                          <div key={a.category} className="flex items-center gap-2 p-2 rounded-lg bg-navy-900/[0.02]">
                            <div className={`w-2.5 h-2.5 rounded-full ${barColors[i % barColors.length]}`} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-navy-900 truncate">{p(a.category)}</p>
                              <p className="text-[10px] text-navy-900/40">{a.percentage} · {a.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {plan.funds?.length > 0 && (
                    <motion.div {...anim(6)} className="glass-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center"><Layers size={14} className="text-purple-500" /></div>
                        <h3 className="text-sm font-bold text-navy-900">{t('xray.holdings', { n: plan.totalFunds })}</h3>
                      </div>
                      <div className="space-y-2">
                        {plan.funds.map((f) => (
                          <div key={f.name} className="flex items-center gap-3 p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-navy-900 truncate">{f.name}</p>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ratingColor[f.rating] || 'bg-navy-900/[0.04] text-navy-900/50'}`}>{p(f.rating)}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${f.plan === 'Direct' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{p(f.plan)}</span>
                              </div>
                              <p className="text-[10px] text-navy-900/40 mt-0.5">{p(f.category)} · {t('xray.ter', { v: f.expenseRatio })} · {p(f.remark)}</p>
                            </div>
                            <span className="text-xs font-extrabold text-navy-900 flex-shrink-0 font-mono">{f.currentValue}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-5">
                    <motion.div {...anim(7)} className="glass-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center"><AlertTriangle size={14} className="text-red-500" /></div>
                        <h3 className="text-sm font-bold text-navy-900">{t('xray.overlap')}</h3>
                      </div>
                      {plan.overlap?.length ? (
                        <div className="space-y-2">
                          {plan.overlap.map((o) => (
                            <div key={o.stock} className="p-2.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-navy-900">{p(o.stock)}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${o.risk === 'HIGH' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{p(o.risk)}</span>
                              </div>
                              <p className="text-[10px] text-navy-900/45">{t('xray.overlapShare', { funds: p(o.funds), exposure: o.exposure })} · {p(o.detail)}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-navy-900/50">{t('xray.noOverlap')}</p>}
                    </motion.div>

                    <motion.div {...anim(8)} className="glass-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center"><BarChart3 size={14} className="text-cyan-600" /></div>
                        <h3 className="text-sm font-bold text-navy-900">{t('xray.returns')}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                          <p className="text-[10px] text-navy-900/40">{t('xray.yourXirr')}</p>
                          <p className="text-sm font-extrabold text-navy-900">{p(plan.benchmarkComparison?.portfolioReturn)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                          <p className="text-[10px] text-navy-900/40">{t('xray.nifty')}</p>
                          <p className="text-sm font-extrabold text-navy-900">{p(plan.benchmarkComparison?.nifty50Return)}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-navy-900/50 mt-3 text-center">{p(plan.benchmarkComparison?.verdict)}</p>
                      {plan.xirrNote && <p className="text-[10px] text-navy-900/35 mt-1 text-center">{p(plan.xirrNote)}</p>}
                    </motion.div>
                  </div>

                  {plan.rebalancing?.length > 0 && (
                    <motion.div {...anim(9)} className="glass-card p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center"><ArrowRightLeft size={14} className="text-emerald-600" /></div>
                          <h3 className="text-sm font-bold text-navy-900">{t('xray.rebal')}</h3>
                          <span className="text-[10px] text-navy-900/35">{t('xray.rebalNote')}</span>
                        </div>
                        {plan.annualSavings && plan.annualSavings !== '₹0' && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">{t('xray.saveYear', { amount: plan.annualSavings })}</span>}
                      </div>
                      <div className="space-y-2">
                        {plan.rebalancing.map((r) => (
                          <div key={r.fund} className="flex items-start gap-3 p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                            <span className="text-[9px] font-extrabold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5 bg-navy-900 text-white">{p(r.action)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-bold text-navy-900">{p(r.fund)}</p>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[r.priority] || ''}`}>{p(r.priority)}</span>
                              </div>
                              <p className={`text-[11px] text-navy-900/45 mt-0.5 ${pending ? 'animate-pulse' : ''}`}>{p(r.reason)}</p>
                            </div>
                            <span className="text-xs font-extrabold text-navy-900 flex-shrink-0 font-mono">{r.amount}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {plan.summary && (
                    <motion.div {...anim(10)} className="glass-card p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-navy-900/[0.05] flex items-center justify-center flex-shrink-0"><Target size={16} className="text-navy-900/50" /></div>
                        <div>
                          <h3 className="text-sm font-bold text-navy-900 mb-1">{t('xray.summary')}</h3>
                          <p className={`text-xs text-navy-900/55 leading-relaxed ${pending ? 'animate-pulse' : ''}`}>{p(plan.summary)}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <ResultFooter
                    meta={plan.meta}
                    citations={stream.citations}
                    pending={pending}
                    module="portfolio"
                    askContext={`Portfolio ${plan.portfolioValue}, ${plan.totalFunds} funds, expense drag ${plan.expenseDrag}, Regular-plan extra cost ${plan.annualSavings}/yr`}
                    suggestions={[t('xray.ask.1'), t('xray.ask.2'), t('xray.ask.3')]}
                  />

                  <div className="flex justify-center pt-1">
                    <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-navy-900/15 text-navy-900/70 text-sm font-medium hover:border-navy-900/30">{t('xray.again')}</button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
