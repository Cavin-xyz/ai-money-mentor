import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, Sparkles, ChevronRight, ChevronLeft, Plus, X, SlidersHorizontal,
  Target, BarChart3, Calendar, Shield, Coins, TrendingUp, Zap, UserRound, RotateCcw, Dice5,
} from 'lucide-react'
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { postJson } from '../lib/api'
import { formatINRCompact } from '../lib/format'
import { useAdvisorStream } from '../hooks/useAdvisorStream'
import { useProfile, profileValues } from '../context/ProfileContext'
import PipelineProgress from './trust/PipelineProgress'
import ResultFooter from './trust/ResultFooter'

const inputClass = "w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-3 text-navy-900 font-bold text-sm focus:outline-none focus:border-navy-900/30 focus:ring-1 focus:ring-navy-900/15 transition-all placeholder-navy-900/25 font-mono"
const labelClass = "block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5"

const PROFILE_MAP = {
  currentAge: 'age', retirementAge: 'retirementAge', monthlyIncome: 'monthlyIncome', monthlyExpenses: 'monthlyExpenses',
  annualBonus: 'annualBonus', currentSavings: 'currentSavings', existingSips: 'existingSips',
  ppfEpfBalance: 'ppfEpfBalance', emergencyFund: 'emergencyFund',
}

const DEFAULT_ASSUMPTIONS = { inflationPct: 6, equityReturnPct: 12, debtReturnPct: 7, withdrawalRatePct: 3.5 }

const card = (i) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.04 * i, duration: 0.3 },
})

function Skeleton({ className = '' }) {
  return <span className={`inline-block rounded bg-navy-900/[0.06] animate-pulse ${className}`} />
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-navy-900/10 shadow-lg rounded-xl px-3 py-2 text-xs space-y-0.5">
      <p className="font-bold text-navy-900">Age {label}</p>
      <p className="text-emerald-700">Projected: {formatINRCompact(d.corpus)}</p>
      <p className="text-navy-900/50">Target: {formatINRCompact(d.target)}</p>
      {d.p10 !== undefined && <p className="text-navy-900/40">Range: {formatINRCompact(d.p10)} – {formatINRCompact(d.p90)}</p>}
    </div>
  )
}

export default function FirePathPlanner() {
  const { profile, hasProfile, goals: savedGoals, restoreRequest, refresh } = useProfile()
  const stream = useAdvisorStream('/api/fire/stream')
  const [formPage, setFormPage] = useState(0)
  const [error, setError] = useState(null)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS)
  const [whatIf, setWhatIf] = useState(null)
  const [formData, setFormData] = useState({
    currentAge: '', retirementAge: '',
    monthlyIncome: '', monthlyExpenses: '', annualBonus: '',
    currentSavings: '', existingSips: '', ppfEpfBalance: '', emergencyFund: '',
    lifeGoals: [],
  })
  const [newGoal, setNewGoal] = useState({ name: '', years: '', amount: '' })

  const { restore, status } = stream
  useEffect(() => {
    if (restoreRequest?.module === 'fire') {
      restore(restoreRequest.result)
      document.getElementById('fire')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [restoreRequest, restore])
  useEffect(() => {
    if (status === 'done') refresh()
  }, [status, refresh])

  const handleChange = (field, value) => setFormData((p) => ({ ...p, [field]: value }))
  const addGoal = () => {
    if (!newGoal.name) return
    setFormData((p) => ({ ...p, lifeGoals: [...p.lifeGoals, { ...newGoal, id: Date.now() }] }))
    setNewGoal({ name: '', years: '', amount: '' })
  }
  const removeGoal = (id) => setFormData((p) => ({ ...p, lifeGoals: p.lifeGoals.filter((g) => g.id !== id) }))
  const fillFromProfile = () => setFormData((p) => ({
    ...p,
    ...profileValues(profile, PROFILE_MAP),
    lifeGoals: p.lifeGoals.length ? p.lifeGoals : savedGoals.map((g) => ({ id: g.id, name: g.name, years: `${g.years}`, amount: `${g.amount}` })),
  }))

  const payload = (overrides = {}) => ({ ...formData, assumptions, ...overrides })

  const handleGenerate = () => {
    if (!formData.currentAge || !formData.monthlyIncome || !formData.monthlyExpenses) {
      setError('Please fill in at least your age, monthly income and expenses.')
      return
    }
    setError(null)
    setWhatIf(null)
    stream.run(payload())
  }

  const runWhatIf = async (label, overrides) => {
    try {
      const data = await postJson('/api/fire/calc', payload(overrides))
      setWhatIf({ label, data })
    } catch (e) {
      setError(e.message)
    }
  }

  const base = stream.data
  const plan = whatIf?.data || base
  const pending = stream.running && !stream.result
  const showResults = stream.status !== 'idle'
  const retireAge = Number(formData.retirementAge) || plan?.retirementAge

  const formPages = [
    {
      title: 'Personal Info',
      fields: (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="fire-age">Current Age</label>
            <input id="fire-age" type="number" value={formData.currentAge} onChange={(e) => handleChange('currentAge', e.target.value)} className={inputClass} placeholder="e.g. 28" />
          </div>
          <div>
            <label className={labelClass} htmlFor="fire-retire">Target Retirement</label>
            <input id="fire-retire" type="number" value={formData.retirementAge} onChange={(e) => handleChange('retirementAge', e.target.value)} className={inputClass} placeholder="e.g. 45" />
          </div>
        </div>
      ),
    },
    {
      title: 'Income & Expenses',
      fields: (
        <div className="space-y-4">
          {[
            ['monthlyIncome', 'Monthly Post-Tax Income (₹)', 'e.g. 150000'],
            ['monthlyExpenses', 'Monthly Expenses (₹)', 'e.g. 50000'],
            ['annualBonus', 'Annual Bonus (₹)', 'e.g. 300000'],
          ].map(([k, l, ph]) => (
            <div key={k}>
              <label className={labelClass} htmlFor={`fire-${k}`}>{l}</label>
              <input id={`fire-${k}`} type="number" value={formData[k]} onChange={(e) => handleChange(k, e.target.value)} className={inputClass} placeholder={ph} />
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Existing Investments',
      fields: (
        <div className="space-y-4">
          {[
            ['currentSavings', 'Current Savings (₹)', 'e.g. 2500000'],
            ['existingSips', 'Monthly SIPs (₹)', 'e.g. 25000'],
            ['ppfEpfBalance', 'PPF/EPF Balance (₹)', 'e.g. 500000'],
            ['emergencyFund', 'Emergency Fund (₹)', 'e.g. 300000'],
          ].map(([k, l, ph]) => (
            <div key={k}>
              <label className={labelClass} htmlFor={`fire-${k}`}>{l}</label>
              <input id={`fire-${k}`} type="number" value={formData[k]} onChange={(e) => handleChange(k, e.target.value)} className={inputClass} placeholder={ph} />
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Life Goals',
      fields: (
        <div className="space-y-4">
          <p className="text-sm text-navy-900/50">Add major goals in today's rupees — the engine inflates them and sizes a SIP for each.</p>
          {formData.lifeGoals.map((g) => (
            <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-navy-900/[0.03] border border-navy-900/[0.06]">
              <div>
                <p className="text-sm font-semibold text-navy-900">{g.name}</p>
                <p className="text-xs text-navy-900/40">₹{Number(g.amount).toLocaleString('en-IN')} in {g.years} yrs</p>
              </div>
              <button onClick={() => removeGoal(g.id)} className="p-1 rounded-lg hover:bg-navy-900/[0.05] text-navy-900/40" aria-label={`Remove ${g.name}`}><X size={14} /></button>
            </div>
          ))}
          <div className="p-4 rounded-xl border border-dashed border-navy-900/15 space-y-3">
            <input type="text" value={newGoal.name} onChange={(e) => setNewGoal((p) => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Goal name (e.g. Dream House)" aria-label="Goal name" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={newGoal.years} onChange={(e) => setNewGoal((p) => ({ ...p, years: e.target.value }))} className={inputClass} placeholder="Years (e.g. 7)" aria-label="Years" />
              <input type="number" value={newGoal.amount} onChange={(e) => setNewGoal((p) => ({ ...p, amount: e.target.value }))} className={inputClass} placeholder="Amount ₹" aria-label="Amount" />
            </div>
            <button onClick={addGoal} disabled={!newGoal.name} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-navy-900/15 text-sm text-navy-900/60 hover:bg-navy-900/[0.03] transition-colors disabled:opacity-30">
              <Plus size={14} /> Add Goal
            </button>
          </div>
        </div>
      ),
    },
  ]

  return (
    <section id="fire" className="py-16 relative scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-10">
          <div className="section-tag mx-auto mb-4"><Flame size={11} /> Calculated, then explained</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">FIRE Path Planner</h1>
          <p className="text-navy-900/50 text-base mt-2 max-w-xl mx-auto">
            Your numbers go through a deterministic engine and 1,000 market scenarios; the local AI only explains the result.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!showResults && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="glass-card p-6 sm:p-8 max-w-2xl mx-auto">
                {hasProfile && (
                  <button onClick={fillFromProfile} className="mb-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-navy-900/[0.04] border border-navy-900/10 text-xs font-semibold text-navy-900/70 hover:bg-navy-900/[0.07]">
                    <UserRound size={13} /> Use my saved numbers
                  </button>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-navy-900/45">Step {formPage + 1} of {formPages.length}</span>
                  <span className="text-xs font-bold text-navy-900">{formPages[formPage].title}</span>
                </div>
                <div className="w-full h-1.5 bg-navy-900/10 rounded-full overflow-hidden mb-6">
                  <motion.div className="h-full bg-navy-900 rounded-full" animate={{ width: `${((formPage + 1) / formPages.length) * 100}%` }} transition={{ duration: 0.3 }} />
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={formPage} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    {formPages[formPage].fields}
                  </motion.div>
                </AnimatePresence>

                {/* Assumptions */}
                <div className="mt-6">
                  <button onClick={() => setShowAssumptions((s) => !s)} className="flex items-center gap-2 text-xs font-semibold text-navy-900/55 hover:text-navy-900">
                    <SlidersHorizontal size={13} /> Assumptions {showAssumptions ? '' : `(inflation ${assumptions.inflationPct}%, equity ${assumptions.equityReturnPct}%, withdrawal ${assumptions.withdrawalRatePct}%)`}
                  </button>
                  {showAssumptions && (
                    <div className="mt-3 grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                      {[
                        ['inflationPct', 'Inflation', 3, 10, 0.5],
                        ['equityReturnPct', 'Equity return', 8, 15, 0.5],
                        ['debtReturnPct', 'Debt return', 5, 9, 0.5],
                        ['withdrawalRatePct', 'Safe withdrawal rate', 2.5, 5, 0.25],
                      ].map(([k, l, min, max, step]) => (
                        <label key={k} className="block">
                          <span className="flex justify-between text-[11px] font-semibold text-navy-900/55 mb-1"><span>{l}</span><span className="font-mono text-navy-900">{assumptions[k]}%</span></span>
                          <input type="range" min={min} max={max} step={step} value={assumptions[k]} onChange={(e) => setAssumptions((a) => ({ ...a, [k]: Number(e.target.value) }))} className="w-full accent-navy-900" />
                        </label>
                      ))}
                      <p className="sm:col-span-2 text-[11px] text-navy-900/40">Long-run assumptions, not guarantees. 3.5% withdrawal is more conservative than the US "4% rule" given higher Indian inflation.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-navy-900/[0.06]">
                  <button onClick={() => setFormPage((p) => p - 1)} disabled={formPage === 0} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-navy-900/10 text-navy-900/50 hover:bg-navy-900/[0.03] text-sm disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={16} /> Back
                  </button>
                  {formPage < formPages.length - 1 ? (
                    <button onClick={() => setFormPage((p) => p + 1)} className="btn-primary flex items-center gap-1.5 text-sm">Continue <ChevronRight size={16} /></button>
                  ) : (
                    <button onClick={handleGenerate} className="btn-primary flex items-center gap-2 text-sm"><Sparkles size={14} /> Generate FIRE Roadmap</button>
                  )}
                </div>
                {error && <p className="mt-3 text-xs text-red-500 text-center">{error}</p>}
              </div>
            </motion.div>
          )}

          {showResults && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              {!whatIf && (
                <PipelineProgress stages={stream.stages} status={stream.status} citations={stream.citations} trust={stream.result?.meta?.trust} />
              )}
              {stream.status === 'error' && (
                <div className="glass-card p-5 text-center">
                  <p className="text-sm text-red-600">{stream.error}</p>
                  <button onClick={() => stream.reset()} className="btn-ghost mt-3 text-xs">Back to the form</button>
                </div>
              )}

              {plan && (
                <>
                  {whatIf && (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
                      <p className="text-xs font-semibold text-blue-800">What-if: {whatIf.label} · recalculated instantly by the engine (no AI)</p>
                      <button onClick={() => setWhatIf(null)} className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"><RotateCcw size={12} /> Back to your plan</button>
                    </div>
                  )}

                  {/* Hero stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'FIRE Number', value: plan.fireNumber, icon: <Flame size={14} className="text-orange-500" /> },
                      { label: plan.feasible ? 'Years to FIRE' : 'FIRE at full surplus', value: plan.feasible ? plan.yearsToFire : (plan.fireAgeWithFullSurplus > 0 ? `Age ${plan.fireAgeWithFullSurplus}` : plan.yearsToFire), icon: <Calendar size={14} className="text-cyan-600" /> },
                      { label: 'Monthly SIP needed', value: plan.requiredMonthlySip, icon: <TrendingUp size={14} className="text-emerald-500" /> },
                      { label: 'Savings rate needed', value: plan.requiredSavingsRate, icon: <Zap size={14} className="text-amber-500" /> },
                    ].map((s, i) => (
                      <motion.div key={s.label} {...card(i)} className="glass-card p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">{s.icon}<span className="text-[9px] font-bold text-navy-900/40 uppercase tracking-wider">{s.label}</span></div>
                        <p className="text-lg font-extrabold text-navy-900 leading-tight">{s.value}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Projection chart */}
                  {plan.projection?.length > 1 && (
                    <motion.div {...card(4)} className="glass-card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center"><TrendingUp size={14} className="text-emerald-600" /></div>
                          <div>
                            <h3 className="text-sm font-bold text-navy-900">Corpus projection</h3>
                            <p className="text-[11px] text-navy-900/45">At the required SIP · shaded band = 10th–90th percentile of 1,000 scenarios</p>
                          </div>
                        </div>
                        {plan.successPct !== undefined && (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${plan.successPct >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : plan.successPct >= 45 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            <Dice5 size={13} /> {plan.successPct}% of scenarios reach the target
                          </span>
                        )}
                      </div>
                      <div className="h-64 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={plan.projection} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                            <XAxis dataKey="age" tick={{ fontSize: 11, fill: 'rgba(10,25,47,0.45)' }} tickLine={false} axisLine={false} />
                            <YAxis tickFormatter={formatINRCompact} tick={{ fontSize: 11, fill: 'rgba(10,25,47,0.45)' }} tickLine={false} axisLine={false} width={64} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey={(d) => [d.p10, d.p90]} stroke="none" fill="#10B981" fillOpacity={0.12} isAnimationActive={false} />
                            <Area type="monotone" dataKey="corpus" stroke="#059669" strokeWidth={2.5} fill="#10B981" fillOpacity={0.06} />
                            <Line type="monotone" dataKey="target" stroke="#0A192F" strokeOpacity={0.45} strokeDasharray="5 4" dot={false} strokeWidth={1.5} />
                            {retireAge && <ReferenceLine x={Number(retireAge)} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Retire', fontSize: 10, fill: '#B45309', position: 'insideTopRight' }} />}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      {/* What-if chips */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40">What if</span>
                        {retireAge && [
                          [`Retire at ${Number(retireAge) - 2}`, { retirementAge: `${Number(retireAge) - 2}` }],
                          [`Retire at ${Number(retireAge) + 3}`, { retirementAge: `${Number(retireAge) + 3}` }],
                          ['+₹5K SIP', { extraMonthlySip: '5000' }],
                          ['Spend 10% less', { monthlyExpenses: `${Math.round(Number(formData.monthlyExpenses) * 0.9)}` }],
                        ].map(([label, o]) => (
                          <button key={label} onClick={() => runWhatIf(label, o)} disabled={!formData.monthlyExpenses} className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${whatIf?.label === label ? 'bg-navy-900 text-white border-navy-900' : 'border-navy-900/15 text-navy-900/65 hover:bg-navy-900/[0.04]'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* SIP allocation */}
                  {plan.sipAllocation?.length > 0 && (
                    <motion.div {...card(5)} className="glass-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center"><BarChart3 size={14} className="text-blue-500" /></div>
                        <h3 className="text-sm font-bold text-navy-900">Monthly SIP allocation</h3>
                        <span className="text-[10px] text-navy-900/35">fund categories, not specific schemes</span>
                      </div>
                      <div className="space-y-2.5">
                        {plan.sipAllocation.map((s) => (
                          <div key={s.category} className="flex items-center gap-3 p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-navy-900">{s.category}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold text-navy-900">{s.amount}</span>
                                  <span className="text-[10px] font-bold text-navy-900/30 bg-navy-900/[0.04] px-1.5 py-0.5 rounded">{s.percentage}</span>
                                </div>
                              </div>
                              <p className="text-[11px] text-navy-900/40 leading-tight truncate">{s.recommendation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Goals */}
                  {plan.goals?.length > 0 && (
                    <motion.div {...card(6)} className="glass-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center"><Target size={14} className="text-purple-500" /></div>
                        <h3 className="text-sm font-bold text-navy-900">Goal-wise breakdown</h3>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {plan.goals.map((g) => (
                          <div key={g.name} className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-navy-900">{g.name}</span>
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{g.timelineYears} yrs</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-navy-900/50">{g.targetToday} today → <strong className="text-navy-900">{g.target}</strong></span>
                              <span className="text-[11px] text-navy-900/50">SIP <strong className="text-navy-900">{g.monthlySlip}</strong></span>
                            </div>
                            <p className="text-[10px] text-navy-900/35 mt-1">{g.fundType}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Milestones */}
                  {plan.milestones?.length > 0 && (
                    <motion.div {...card(7)} className="glass-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center"><Calendar size={14} className="text-cyan-600" /></div>
                        <h3 className="text-sm font-bold text-navy-900">Milestone timeline</h3>
                      </div>
                      <div className="relative">
                        {plan.milestones.map((m, i) => (
                          <div key={m.year} className="flex gap-3 pb-4 last:pb-0">
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${i === plan.milestones.length - 1 ? 'bg-emerald-500 border-emerald-400' : 'bg-white border-navy-900/20'}`} />
                              {i < plan.milestones.length - 1 && <div className="w-0.5 flex-1 bg-navy-900/10 mt-1" />}
                            </div>
                            <div className="flex-1 min-w-0 -mt-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-extrabold text-navy-900">{m.year}</span>
                                <span className="text-[10px] text-navy-900/40">age {m.age}</span>
                                <span className="text-xs font-bold text-emerald-600">{m.portfolioValue}</span>
                                <span className="text-[9px] text-navy-900/30 bg-navy-900/[0.04] px-1.5 py-0.5 rounded">{m.allocation}</span>
                              </div>
                              <p className="text-[11px] text-navy-900/55 mt-0.5">{pending ? <Skeleton className="w-3/4 h-3" /> : m.action}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Insurance & Tax */}
                  <div className="grid sm:grid-cols-2 gap-5">
                    {plan.insurance && (
                      <motion.div {...card(8)} className="glass-card p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center"><Shield size={14} className="text-emerald-500" /></div>
                          <h3 className="text-sm font-bold text-navy-900">Insurance & safety net</h3>
                        </div>
                        <div className="space-y-2.5">
                          {[
                            { label: 'Term life', value: plan.insurance.termLife?.recommended, note: plan.insurance.termLife?.note },
                            { label: 'Health cover', value: plan.insurance.health?.recommended, note: plan.insurance.health?.note },
                            { label: 'Emergency fund', value: plan.insurance.emergencyFund?.target, note: `${plan.insurance.emergencyFund?.note} · gap ${plan.insurance.emergencyFund?.currentGap}` },
                          ].filter((x) => x.value).map((item) => (
                            <div key={item.label} className="flex items-center justify-between p-2.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                              <div>
                                <span className="text-xs font-bold text-navy-900">{item.label}</span>
                                <p className="text-[10px] text-navy-900/35">{item.note}</p>
                              </div>
                              <span className="text-xs font-extrabold text-navy-900">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    <motion.div {...card(9)} className="glass-card p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center"><Coins size={14} className="text-amber-500" /></div>
                        <h3 className="text-sm font-bold text-navy-900">Tax-saving moves</h3>
                      </div>
                      <div className="space-y-2">
                        {(plan.taxMoves || []).map((t) => (
                          <div key={t.section} className="flex items-center justify-between p-2.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                            <div>
                              <span className="text-xs font-bold text-navy-900">{t.section}</span>
                              <p className="text-[10px] text-navy-900/35">{t.action}</p>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-600">–{t.saving}</span>
                          </div>
                        ))}
                        {!plan.taxMoves?.length && <p className="text-xs text-navy-900/45">No deduction changes would lower your tax.</p>}
                      </div>
                      {plan.regimeRecommendation && (
                        <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-center">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Better for you: {plan.regimeRecommendation}</span>
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* FIRE impact */}
                  <motion.div {...card(10)} className="glass-card p-4 text-center">
                    <p className="text-sm font-semibold text-navy-900/75">
                      <Sparkles size={14} className="inline -mt-0.5 mr-1 text-amber-500" />
                      {pending ? <Skeleton className="w-2/3 h-4 align-middle" /> : plan.fireImpact}
                    </p>
                  </motion.div>

                  {!whatIf && (
                    <ResultFooter
                      meta={plan.meta}
                      citations={stream.citations}
                      pending={pending}
                      module="fire"
                      askContext={`FIRE number ${plan.fireNumber}; required SIP ${plan.requiredMonthlySip}; savings rate needed ${plan.requiredSavingsRate}; regime ${plan.regimeRecommendation}`}
                      suggestions={['Should I use NPS for retirement?', 'Is PPF interest tax-free?', 'What is a safe withdrawal rate?']}
                    />
                  )}

                  <div className="flex justify-center pt-1">
                    <button onClick={() => { stream.reset(); setWhatIf(null); setFormPage(0) }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-navy-900/15 text-navy-900/70 text-sm font-medium hover:border-navy-900/30 transition-colors">
                      Re-plan with updated data
                    </button>
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
