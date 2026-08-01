import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, Sparkles, Loader2, ChevronRight, ChevronLeft, Plus, X,
  Target, BarChart3, Calendar, Shield, Coins, TrendingUp, Heart, Zap
} from 'lucide-react'

const inputClass = "w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-3 text-navy-900 font-bold text-sm focus:outline-none focus:border-navy-900/30 focus:ring-1 focus:ring-navy-900/15 transition-all placeholder-navy-900/25 font-mono"

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

async function fetchFirePlan(profile) {
  const response = await fetch(`${API_URL}/api/fire/planner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || `HTTP error! Status: ${response.status}`)
  }
  // AI returns JSON string — parse it
  const text = data.response || ''
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

/* ── Card animation stagger ── */
const card = (i) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.3 },
})

export default function FirePathPlanner() {
  const [step, setStep] = useState('form')
  const [formPage, setFormPage] = useState(0)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    currentAge: '', retirementAge: '',
    monthlyIncome: '', monthlyExpenses: '', annualBonus: '',
    currentSavings: '', existingSips: '', ppfEpfBalance: '', emergencyFund: '',
    lifeGoals: [],
  })
  const [newGoal, setNewGoal] = useState({ name: '', years: '', amount: '' })

  const handleChange = (field, value) => setFormData(p => ({ ...p, [field]: value }))
  const addGoal = () => {
    if (!newGoal.name) return
    setFormData(p => ({ ...p, lifeGoals: [...p.lifeGoals, { ...newGoal, id: Date.now() }] }))
    setNewGoal({ name: '', years: '', amount: '' })
  }
  const removeGoal = (id) => setFormData(p => ({ ...p, lifeGoals: p.lifeGoals.filter(g => g.id !== id) }))

  /* ── Form Pages ── */
  const formPages = [
    {
      title: 'Personal Info',
      fields: (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Current Age</label>
            <input type="number" value={formData.currentAge} onChange={e => handleChange('currentAge', e.target.value)} className={inputClass} placeholder="e.g. 28" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Target Retirement</label>
            <input type="number" value={formData.retirementAge} onChange={e => handleChange('retirementAge', e.target.value)} className={inputClass} placeholder="e.g. 45" />
          </div>
        </div>
      ),
    },
    {
      title: 'Income & Expenses',
      fields: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Monthly Post-Tax Income (₹)</label>
            <input type="number" value={formData.monthlyIncome} onChange={e => handleChange('monthlyIncome', e.target.value)} className={inputClass} placeholder="e.g. 150000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Monthly Expenses (₹)</label>
            <input type="number" value={formData.monthlyExpenses} onChange={e => handleChange('monthlyExpenses', e.target.value)} className={inputClass} placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Annual Bonus (₹)</label>
            <input type="number" value={formData.annualBonus} onChange={e => handleChange('annualBonus', e.target.value)} className={inputClass} placeholder="e.g. 300000" />
          </div>
        </div>
      ),
    },
    {
      title: 'Existing Investments',
      fields: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Current Savings (₹)</label>
            <input type="number" value={formData.currentSavings} onChange={e => handleChange('currentSavings', e.target.value)} className={inputClass} placeholder="e.g. 2500000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Monthly SIPs (₹)</label>
            <input type="number" value={formData.existingSips} onChange={e => handleChange('existingSips', e.target.value)} className={inputClass} placeholder="e.g. 25000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">PPF/EPF Balance (₹)</label>
            <input type="number" value={formData.ppfEpfBalance} onChange={e => handleChange('ppfEpfBalance', e.target.value)} className={inputClass} placeholder="e.g. 500000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Emergency Fund (₹)</label>
            <input type="number" value={formData.emergencyFund} onChange={e => handleChange('emergencyFund', e.target.value)} className={inputClass} placeholder="e.g. 300000" />
          </div>
        </div>
      ),
    },
    {
      title: 'Life Goals',
      fields: (
        <div className="space-y-4">
          <p className="text-sm text-navy-900/50">Add major financial goals — AI will include them in your roadmap.</p>
          {formData.lifeGoals.map(g => (
            <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-navy-900/[0.03] border border-navy-900/[0.06]">
              <div>
                <p className="text-sm font-semibold text-navy-900">{g.name}</p>
                <p className="text-xs text-navy-900/40">₹{Number(g.amount).toLocaleString('en-IN')} in {g.years} yrs</p>
              </div>
              <button onClick={() => removeGoal(g.id)} className="p-1 rounded-lg hover:bg-navy-900/[0.05] text-navy-900/40"><X size={14} /></button>
            </div>
          ))}
          <div className="p-4 rounded-xl border border-dashed border-navy-900/15 space-y-3">
            <input type="text" value={newGoal.name} onChange={e => setNewGoal(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Goal name (e.g. Dream House)" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={newGoal.years} onChange={e => setNewGoal(p => ({ ...p, years: e.target.value }))} className={inputClass} placeholder="Years (e.g. 7)" />
              <input type="number" value={newGoal.amount} onChange={e => setNewGoal(p => ({ ...p, amount: e.target.value }))} className={inputClass} placeholder="Amount ₹" />
            </div>
            <button onClick={addGoal} disabled={!newGoal.name} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-navy-900/15 text-sm text-navy-900/60 hover:bg-navy-900/[0.03] transition-colors disabled:opacity-30">
              <Plus size={14} /> Add Goal
            </button>
          </div>
        </div>
      ),
    },
  ]

  const handleGenerate = async () => {
    if (!formData.currentAge || !formData.monthlyIncome) {
      setError('Please fill in at least your age and monthly income.')
      return
    }
    setStep('loading'); setError(null)
    try {
      const result = await fetchFirePlan(formData)
      setPlan(result)
      setStep('results')
    } catch (err) {
      console.error('FIRE error:', err)
      setError(err.message || 'AI analysis failed. Please try again.')
      setStep('form')
    }
  }

  return (
    <section id="fire" className="py-16 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="section-tag mx-auto mb-4"><Flame size={11} /> AI-Powered</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">FIRE Path Planner</h1>
          <p className="text-navy-900/50 text-base mt-2 max-w-xl mx-auto">
            Enter your financial profile and let AI create a personalized roadmap to Financial Independence.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* ── FORM ── */}
          {step === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="glass-card p-6 sm:p-8 max-w-2xl mx-auto">
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
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-navy-900/[0.06]">
                  <button onClick={() => setFormPage(p => p - 1)} disabled={formPage === 0} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-navy-900/10 text-navy-900/50 hover:bg-navy-900/[0.03] text-sm disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={16} /> Back
                  </button>
                  {formPage < formPages.length - 1 ? (
                    <button onClick={() => setFormPage(p => p + 1)} className="btn-primary flex items-center gap-1.5 text-sm">Continue <ChevronRight size={16} /></button>
                  ) : (
                    <button onClick={handleGenerate} className="btn-primary flex items-center gap-2 text-sm"><Sparkles size={14} /> Generate FIRE Roadmap</button>
                  )}
                </div>
                {error && <p className="mt-3 text-xs text-red-500 text-center">{error}</p>}
              </div>
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {step === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-navy-900/[0.05] flex items-center justify-center mb-6">
                <Loader2 size={36} className="text-navy-900/40 animate-spin" />
              </div>
              <p className="text-lg font-semibold text-navy-900 mb-2">Building your FIRE roadmap…</p>
              <p className="text-sm text-navy-900/40">Analyzing your profile with AI</p>
            </motion.div>
          )}

          {/* ── RESULTS ── */}
          {step === 'results' && plan && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* ─ Hero Stats ─ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'FIRE Number', value: plan.fireNumber, icon: <Flame size={14} className="text-orange-500" /> },
                  { label: 'Years to FIRE', value: plan.yearsToFire, icon: <Calendar size={14} className="text-cyan-600" /> },
                  { label: 'Monthly SIP', value: plan.requiredMonthlySip, icon: <TrendingUp size={14} className="text-emerald-500" /> },
                  { label: 'Savings Rate', value: plan.requiredSavingsRate, icon: <Zap size={14} className="text-amber-500" /> },
                ].map((s, i) => (
                  <motion.div key={i} {...card(i)} className="glass-card p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">{s.icon}<span className="text-[9px] font-bold text-navy-900/40 uppercase tracking-wider">{s.label}</span></div>
                    <p className="text-lg font-extrabold text-navy-900 leading-tight">{s.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* ─ SIP Allocation ─ */}
              {plan.sipAllocation?.length > 0 && (
                <motion.div {...card(4)} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center"><BarChart3 size={14} className="text-blue-500" /></div>
                    <h3 className="text-sm font-bold text-navy-900">Monthly SIP Allocation</h3>
                  </div>
                  <div className="space-y-2.5">
                    {plan.sipAllocation.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
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

              {/* ─ Goal Breakdown ─ */}
              {plan.goals?.length > 0 && (
                <motion.div {...card(5)} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center"><Target size={14} className="text-purple-500" /></div>
                    <h3 className="text-sm font-bold text-navy-900">Goal-wise Breakdown</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {plan.goals.map((g, i) => (
                      <div key={i} className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-navy-900">{g.name}</span>
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{g.timelineYears} yrs</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-navy-900/50">Target: <strong className="text-navy-900">{g.target}</strong></span>
                          <span className="text-[11px] text-navy-900/50">SIP: <strong className="text-navy-900">{g.monthlySip || g.monthlySlip}</strong></span>
                        </div>
                        <p className="text-[10px] text-navy-900/35 mt-1">{g.fundType}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─ Milestone Timeline ─ */}
              {plan.milestones?.length > 0 && (
                <motion.div {...card(6)} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center"><Calendar size={14} className="text-cyan-600" /></div>
                    <h3 className="text-sm font-bold text-navy-900">Milestone Timeline</h3>
                  </div>
                  <div className="relative space-y-0">
                    {plan.milestones.map((m, i) => (
                      <div key={i} className="flex gap-3 pb-4 last:pb-0">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${i === plan.milestones.length - 1 ? 'bg-emerald-500 border-emerald-400' : 'bg-white border-navy-900/20'}`} />
                          {i < plan.milestones.length - 1 && <div className="w-0.5 flex-1 bg-navy-900/10 mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 -mt-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-extrabold text-navy-900">{m.year}</span>
                            <span className="text-xs font-bold text-emerald-600">{m.portfolioValue}</span>
                            <span className="text-[9px] text-navy-900/30 bg-navy-900/[0.04] px-1.5 py-0.5 rounded">{m.allocation}</span>
                          </div>
                          <p className="text-[11px] text-navy-900/50 mt-0.5">{m.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─ Insurance & Tax (side by side) ─ */}
              <div className="grid sm:grid-cols-2 gap-5">
                {/* Insurance */}
                {plan.insurance && (
                  <motion.div {...card(7)} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center"><Shield size={14} className="text-emerald-500" /></div>
                      <h3 className="text-sm font-bold text-navy-900">Insurance & Safety</h3>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Term Life', value: plan.insurance.termLife?.recommended, note: plan.insurance.termLife?.note },
                        { label: 'Health Cover', value: plan.insurance.health?.recommended, note: plan.insurance.health?.note },
                        { label: 'Emergency Fund', value: plan.insurance.emergencyFund?.target, note: plan.insurance.emergencyFund?.note },
                      ].filter(x => x.value).map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
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

                {/* Tax Moves */}
                {plan.taxMoves?.length > 0 && (
                  <motion.div {...card(8)} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center"><Coins size={14} className="text-amber-500" /></div>
                      <h3 className="text-sm font-bold text-navy-900">Tax-Saving Moves</h3>
                    </div>
                    <div className="space-y-2">
                      {plan.taxMoves.map((t, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                          <div>
                            <span className="text-xs font-bold text-navy-900">Sec {t.section}</span>
                            <p className="text-[10px] text-navy-900/35">{t.action}</p>
                          </div>
                          <span className="text-xs font-extrabold text-emerald-600">–{t.saving}</span>
                        </div>
                      ))}
                    </div>
                    {plan.regimeRecommendation && (
                      <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-center">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Recommended: {plan.regimeRecommendation}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* ─ FIRE Impact ─ */}
              {plan.fireImpact && (
                <motion.div {...card(9)} className="glass-card p-4 text-center">
                  <p className="text-sm font-semibold text-navy-900/70">
                    <Sparkles size={14} className="inline -mt-0.5 mr-1 text-amber-500" />
                    {plan.fireImpact}
                  </p>
                </motion.div>
              )}

              {/* Re-plan */}
              <div className="flex justify-center pt-1">
                <button onClick={() => { setStep('form'); setFormPage(0); setPlan(null) }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-navy-900/15 text-navy-900/70 text-sm font-medium hover:border-navy-900/30 transition-colors">
                  Re-plan with Updated Data
                </button>
              </div>
              <p className="text-center text-navy-900/25 text-[10px]">* AI-generated roadmap. Consult a SEBI-registered advisor before investing.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
