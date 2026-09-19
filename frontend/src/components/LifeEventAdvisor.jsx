import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts'
import {
  Sparkles, Gift, Heart, Baby, Briefcase, Home, Landmark, Check, Square,
  TrendingUp, Flame, ChevronRight, Receipt, UserRound, Activity,
} from 'lucide-react'
import { useAdvisorStream } from '../hooks/useAdvisorStream'
import { useProfile } from '../context/ProfileContext'
import { formatINR } from '../lib/format'
import PipelineProgress from './trust/PipelineProgress'
import { useLanguage } from '../context/LanguageContext'
import ResultFooter from './trust/ResultFooter'

// Labels come from i18n: life.event.<id> and life.amount.<id>
const LIFE_EVENTS = [
  { id: 'bonus', icon: Gift, defaultAmount: '500000' },
  { id: 'marriage', icon: Heart, defaultAmount: '1500000' },
  { id: 'baby', icon: Baby, defaultAmount: '150000' },
  { id: 'inheritance', icon: Landmark, defaultAmount: '5000000' },
  { id: 'job_change', icon: Briefcase, defaultAmount: '2500000' },
  { id: 'home', icon: Home, defaultAmount: '8000000' },
]

// [field, label key (life.x.<field>), placeholder]
const EXTRAS = {
  home: [
    ['loanRatePct', '8.5'],
    ['tenureYears', '20'],
    ['downPaymentPct', '20'],
  ],
  job_change: [['yearsAtEmployer', '']],
}

const PRIORITY_STYLE = {
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const fieldClass = 'w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-3 py-2.5 text-navy-900 font-bold text-sm focus:outline-none focus:border-navy-900/30 font-mono'

export default function LifeEventAdvisor() {
  const { profile, hasProfile, openDrawer, restoreRequest, refresh } = useProfile()
  const { t, p } = useLanguage()
  const stream = useAdvisorStream('/api/life-event/stream')
  const [selectedEvent, setSelectedEvent] = useState(LIFE_EVENTS[0])
  const [amount, setAmount] = useState(LIFE_EVENTS[0].defaultAmount)
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [extras, setExtras] = useState({})
  const [checked, setChecked] = useState({})
  const [error, setError] = useState(null)

  const { restore, status } = stream
  useEffect(() => {
    if (restoreRequest?.module === 'life-event') {
      restore(restoreRequest.result)
      document.getElementById('advisor')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [restoreRequest, restore])
  useEffect(() => {
    if (status === 'done') refresh()
  }, [status, refresh])

  const selectEvent = (event) => {
    setSelectedEvent(event)
    setAmount(event.defaultAmount)
    setExtras({})
    setChecked({})
    setError(null)
    stream.reset()
  }

  const analyze = () => {
    const amt = Number(String(amount).replace(/[,\s₹]/g, ''))
    if (!amt) {
      setError('life.errAmount')
      return
    }
    setError(null)
    setChecked({})
    const x = { ...extras }
    if (monthlyIncome) x.monthlyIncome = monthlyIncome
    stream.run({ eventType: selectedEvent.id, amount: amt, extras: x })
  }

  const advisory = stream.data
  const pending = stream.running && !stream.result
  const profileIncome = hasProfile && Number(profile?.monthlyIncome) > 0 ? Number(profile.monthlyIncome) : 0
  const health = advisory?.healthImpact
  const chartData = health ? [
    { name: t('life.before'), score: health.before },
    { name: t('life.after'), score: health.after },
  ] : []

  return (
    <section id="advisor" className="py-16 relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="section-tag mb-4"><Sparkles size={11} /> {t('life.tag')}</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">{t('life.title')}</h1>
          <p className="text-navy-900/50 text-base mt-2 max-w-2xl">
            {t('life.sub')}
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-5">
          <div className="grid lg:grid-cols-5 gap-5 items-start">
            {/* Inputs */}
            <div className="lg:col-span-2 glass-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900 mb-4">
                <Sparkles size={14} className="text-navy-900/40" /> {t('life.select')}
              </h2>
              <div className="space-y-2" role="radiogroup" aria-label={t('life.selectAria')}>
                {LIFE_EVENTS.map((event) => {
                  const Icon = event.icon
                  const isSelected = selectedEvent.id === event.id
                  return (
                    <button
                      key={event.id}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => selectEvent(event)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${isSelected
                        ? 'border-navy-900 bg-navy-900 text-white shadow-md'
                        : 'border-navy-900/[0.08] bg-white text-navy-900/70 hover:border-navy-900/20 hover:bg-navy-900/[0.02]'}`}
                    >
                      <Icon size={16} className={isSelected ? 'text-white/80' : 'text-navy-900/40'} />
                      {t(`life.event.${event.id}`)}
                      {isSelected && <Check size={14} className="ml-auto text-white/80" />}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-navy-900/[0.06] space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-navy-900/45 uppercase tracking-wider">{t(`life.amount.${selectedEvent.id}`)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full mt-2 bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-3 text-navy-900 font-bold text-lg focus:outline-none focus:border-navy-900/30 font-mono"
                  />
                </label>

                {selectedEvent.id !== 'baby' && (profileIncome && !monthlyIncome ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-navy-900/[0.03] border border-navy-900/[0.08] text-xs">
                    <span className="flex items-center gap-1.5 text-navy-900/65"><UserRound size={12} /> {t('life.profileIncome', { amount: formatINR(profileIncome) })}</span>
                    <button onClick={() => setMonthlyIncome(String(profileIncome))} className="font-semibold text-navy-900/60 hover:text-navy-900">{t('common.edit')}</button>
                  </div>
                ) : (
                  <label className="block">
                    <span className="text-[11px] font-semibold text-navy-900/45">{t('life.incomeLabel')}</span>
                    <input value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} inputMode="numeric" placeholder={t('common.eg', { v: 150000 })} className={`${fieldClass} mt-1`} />
                    {!hasProfile && (
                      <button onClick={() => openDrawer('profile')} className="mt-1 text-[11px] text-blue-600 hover:underline">{t('life.saveProfileHint')}</button>
                    )}
                  </label>
                ))}

                {EXTRAS[selectedEvent.id] && (
                  <div className="grid grid-cols-2 gap-2">
                    {EXTRAS[selectedEvent.id].map(([k, ph]) => (
                      <label key={k} className="block">
                        <span className="text-[11px] font-semibold text-navy-900/45">{t(`life.x.${k}`)}</span>
                        <input value={extras[k] ?? ''} placeholder={ph} onChange={(e) => setExtras((x) => ({ ...x, [k]: e.target.value }))} inputMode="decimal" className={`${fieldClass} mt-1`} />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={analyze} disabled={stream.running} className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm disabled:opacity-60">
                <Sparkles size={14} /> {stream.running ? t('common.working') : t('life.build')}
              </button>
              {error && <p className="mt-2 text-xs text-amber-600 text-center">{t(error)}</p>}
            </div>

            {/* Results */}
            <div className="lg:col-span-3 space-y-5">
              {stream.status === 'idle' && (
                <div className="glass-card p-10 flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="w-16 h-16 rounded-2xl bg-navy-900/[0.05] border border-navy-900/10 flex items-center justify-center mb-5">
                    <Sparkles size={28} className="text-navy-900/25" />
                  </div>
                  <h3 className="text-lg font-bold text-navy-900/60 mb-2">{t('life.empty.title')}</h3>
                  <p className="text-sm text-navy-900/35 max-w-sm leading-relaxed">
                    {t('life.empty.body')}
                  </p>
                </div>
              )}

              {stream.status !== 'idle' && (
                <PipelineProgress stages={stream.stages} status={stream.status} citations={stream.citations} trust={stream.result?.meta?.trust} />
              )}
              {stream.status === 'error' && <div className="glass-card p-5 text-sm text-red-600 text-center">{t(stream.error)}</div>}

              <AnimatePresence>
                {advisory && (
                  <motion.div key="result" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <div className="glass-card p-6">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">{t('life.plan')}</p>
                      <h2 className={`text-2xl font-extrabold text-navy-900 leading-snug ${pending ? 'opacity-60' : ''}`}>{p(advisory.headline)}</h2>
                      {!advisory.profileUsed && (
                        <p className="mt-2 text-[11px] text-navy-900/45">{t('life.assumed')}</p>
                      )}
                    </div>

                    {/* Tax impact */}
                    <div className="glass-card p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center"><Receipt size={15} className="text-amber-600" /></div>
                          <div>
                            <p className="text-sm font-bold text-navy-900">{t('life.taxTitle')}</p>
                            <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[advisory.taxImpact?.priority] || PRIORITY_STYLE.MEDIUM}`}>{t('life.priority', { p: p(advisory.taxImpact?.priority) })}</span>
                          </div>
                        </div>
                        <p className="text-xl font-extrabold text-navy-900 font-mono">{advisory.taxImpact?.estimatedLiability}</p>
                      </div>
                      <p className={`mt-3 text-xs text-navy-900/60 leading-relaxed ${pending ? 'animate-pulse' : ''}`}>{p(advisory.taxImpact?.description)}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      {[
                        ['life.immediate', ChevronRight, advisory.immediateActions],
                        ['life.longTerm', TrendingUp, advisory.longTermAllocation],
                      ].map(([title, Icon, items]) => (
                        <div key={title} className="glass-card p-5">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900 mb-4"><Icon size={14} className="text-navy-900/40" /> {t(title)}</h3>
                          <div className="space-y-3">
                            {items?.map((a) => (
                              <div key={a.title} className="p-3.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p className="text-sm font-semibold text-navy-900">{p(a.title)}</p>
                                  <span className="text-sm font-bold text-navy-900 flex-shrink-0 font-mono">{a.amount}</span>
                                </div>
                                <p className={`text-xs text-navy-900/45 leading-relaxed ${pending ? 'animate-pulse' : ''}`}>{p(a.description)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      {/* Health before/after */}
                      <div className="glass-card p-5">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900 mb-1"><Activity size={14} className="text-navy-900/40" /> {t('life.healthTitle')}</h3>
                        <p className="text-[11px] text-navy-900/45 mb-3">{t('life.healthSub')}</p>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 18, right: 8, left: -24, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(10,25,47,0.5)' }} axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'rgba(10,25,47,0.35)' }} axisLine={false} tickLine={false} />
                              <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={56}>
                                {chartData.map((d, i) => <Cell key={d.name} fill={i === 0 ? 'rgba(10,25,47,0.25)' : (health.points >= 0 ? '#10B981' : '#EF4444')} />)}
                                <LabelList dataKey="score" position="top" style={{ fontSize: 12, fontWeight: 700, fill: '#0A192F' }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {health && (
                          <p className={`text-center text-xs font-bold ${health.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {t('life.points', { n: `${health.points >= 0 ? '+' : ''}${health.points}` })}
                          </p>
                        )}
                      </div>

                      {/* Checklist */}
                      <div className="glass-card p-5">
                        <h3 className="text-sm font-bold text-navy-900 mb-3">{t('life.checklist')}</h3>
                        <ul className="space-y-2">
                          {advisory.checklist?.map((item, i) => (
                            <li key={item}>
                              <button onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))} className="w-full flex items-start gap-2.5 text-left text-xs text-navy-900/70 hover:text-navy-900" aria-pressed={!!checked[i]}>
                                {checked[i] ? <Check size={15} className="text-emerald-600 flex-shrink-0 mt-px" /> : <Square size={15} className="text-navy-900/30 flex-shrink-0 mt-px" />}
                                <span className={checked[i] ? 'line-through text-navy-900/40' : ''}>{p(item)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {advisory.fireImpact && (
                          <div className="mt-4 p-3 rounded-xl bg-navy-900/[0.04] border border-navy-900/10 flex items-start gap-2.5">
                            <Flame size={14} className="text-navy-900/50 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-navy-900/50 uppercase tracking-wider mb-0.5">{t('life.fireImpact')}</p>
                              <p className="text-xs text-navy-900/65 leading-relaxed">{p(advisory.fireImpact)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <ResultFooter
                      meta={advisory.meta}
                      citations={stream.citations}
                      pending={pending}
                      module="life-event"
                      askContext={`${advisory.headline}; tax/costs ${advisory.taxImpact?.estimatedLiability}; health ${health?.before}→${health?.after}`}
                      suggestions={selectedEvent.id === 'home'
                        ? [t('life.ask.home1'), t('life.ask.home2')]
                        : [t('life.ask.other1'), t('life.ask.other2')]}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
