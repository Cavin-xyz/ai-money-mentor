import { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import { Activity, Sparkles, Loader2, ChevronRight, ChevronLeft } from 'lucide-react'

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-navy-900/10 shadow-lg rounded-xl px-3 py-2 text-xs">
        <p className="text-navy-900 font-semibold">{payload[0].payload.dimension}</p>
        <p className="text-navy-800 font-bold">{payload[0].value}<span className="text-navy-900/40">/100</span></p>
      </div>
    )
  }
  return null
}

function ScoreBar({ value, color }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-navy-900/[0.06] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  )
}

const inputClass = "w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:border-navy-900/30 focus:ring-1 focus:ring-navy-900/15 transition-all font-mono placeholder-navy-900/25 text-sm"

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

async function fetchHealthAnalysis(prompt) {
  const response = await fetch(`${API_URL}/api/health-score/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  const text = await response.text()
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!response.ok || parsed.error) {
    throw new Error(parsed.error || `HTTP error! Status: ${response.status}`)
  }
  return parsed
}

export default function MoneyHealthScore() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const [step, setStep] = useState('form') // form | loading | results
  const [formPage, setFormPage] = useState(0)
  const [formData, setFormData] = useState({
    monthlyIncome: '',
    monthlyExpenses: '',
    liquidSavings: '',
    dependents: 'No',
    lifeCover: '',
    healthCover: '',
    investOutsideFd: 'Yes',
    equityPct: '60',
    debtPct: '40',
    monthlyEmi: '',
    exhausted80C: 'No',
    claim80D: 'No',
    useNPS: 'No',
    currentAge: '',
    targetRetirementAge: '60',
    retirementCorpus: '',
  })
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleButton = (field, opt, currentValue) => (
    <button
      key={opt}
      onClick={() => handleChange(field, opt)}
      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${currentValue === opt ? 'border-navy-900 bg-navy-900/[0.06] text-navy-900 font-semibold' : 'border-navy-900/10 bg-navy-900/[0.02] text-navy-900/50 hover:bg-navy-900/[0.04]'}`}
    >
      {opt}
    </button>
  )

  const formPages = [
    {
      title: 'Income & Emergency',
      fields: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Monthly Take-Home Income (₹)</label>
            <input type="number" value={formData.monthlyIncome} onChange={e => handleChange('monthlyIncome', e.target.value)} className={inputClass} placeholder="e.g. 150000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Monthly Expenses (₹)</label>
            <input type="number" value={formData.monthlyExpenses} onChange={e => handleChange('monthlyExpenses', e.target.value)} className={inputClass} placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Liquid Savings — FDs, Savings A/C, Liquid Funds (₹)</label>
            <input type="number" value={formData.liquidSavings} onChange={e => handleChange('liquidSavings', e.target.value)} className={inputClass} placeholder="e.g. 300000" />
          </div>
        </div>
      ),
    },
    {
      title: 'Insurance & Debt',
      fields: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Financial Dependents?</label>
            <div className="flex gap-3">{['Yes', 'No'].map(opt => toggleButton('dependents', opt, formData.dependents))}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Term Life Insurance Cover (₹)</label>
            <input type="number" value={formData.lifeCover} onChange={e => handleChange('lifeCover', e.target.value)} className={inputClass} placeholder="e.g. 10000000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Health Insurance Cover (₹)</label>
            <input type="number" value={formData.healthCover} onChange={e => handleChange('healthCover', e.target.value)} className={inputClass} placeholder="e.g. 1000000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Total Monthly EMI — All Loans (₹)</label>
            <input type="number" value={formData.monthlyEmi} onChange={e => handleChange('monthlyEmi', e.target.value)} className={inputClass} placeholder="e.g. 35000" />
          </div>
        </div>
      ),
    },
    {
      title: 'Investments & Tax',
      fields: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Invest beyond FDs/Savings?</label>
            <div className="flex gap-3">{['Yes', 'No'].map(opt => toggleButton('investOutsideFd', opt, formData.investOutsideFd))}</div>
          </div>
          {formData.investOutsideFd === 'Yes' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">% Equity</label>
                <input type="number" max="100" value={formData.equityPct} onChange={e => handleChange('equityPct', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">% Debt</label>
                <input type="number" max="100" value={formData.debtPct} onChange={e => handleChange('debtPct', e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Exhausted 80C limit (₹1.5L)?</label>
            <div className="flex gap-3">{['Yes', 'No'].map(opt => toggleButton('exhausted80C', opt, formData.exhausted80C))}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Claim health insurance under 80D?</label>
            <div className="flex gap-3">{['Yes', 'No'].map(opt => toggleButton('claim80D', opt, formData.claim80D))}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Contribute to NPS (80CCD)?</label>
            <div className="flex gap-3">{['Yes', 'No'].map(opt => toggleButton('useNPS', opt, formData.useNPS))}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Retirement',
      fields: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Current Age</label>
              <input type="number" value={formData.currentAge} onChange={e => handleChange('currentAge', e.target.value)} className={inputClass} placeholder="e.g. 30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Target Retirement Age</label>
              <input type="number" value={formData.targetRetirementAge} onChange={e => handleChange('targetRetirementAge', e.target.value)} className={inputClass} placeholder="e.g. 50" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-1.5">Retirement Corpus So Far (₹)</label>
            <input type="number" value={formData.retirementCorpus} onChange={e => handleChange('retirementCorpus', e.target.value)} className={inputClass} placeholder="e.g. 2500000" />
            <p className="text-[10px] text-navy-900/30 mt-1.5">Include EPF, PPF, NPS, equity MFs mapped to retirement</p>
          </div>
        </div>
      ),
    },
  ]

  const handleAnalyze = async () => {
    setStep('loading')
    setError(null)

    const prompt = `
Analyze the following user's financial health data:

INCOME & SAVINGS:
- Monthly Take-Home Income: ₹${formData.monthlyIncome || '0'}
- Monthly Expenses: ₹${formData.monthlyExpenses || '0'}
- Liquid Savings (FDs, Savings, Liquid Funds): ₹${formData.liquidSavings || '0'}

INSURANCE & DEBT:
- Has Financial Dependents: ${formData.dependents}
- Term Life Insurance Cover: ₹${formData.lifeCover || '0'}
- Health Insurance Cover: ₹${formData.healthCover || '0'}
- Total Monthly EMI (all loans): ₹${formData.monthlyEmi || '0'}

INVESTMENTS:
- Invests beyond FDs: ${formData.investOutsideFd}
- Portfolio Split: ${formData.equityPct}% Equity / ${formData.debtPct}% Debt

TAX EFFICIENCY:
- Exhausted 80C limit (₹1.5L): ${formData.exhausted80C}
- Claims 80D deduction: ${formData.claim80D}
- Contributes to NPS (80CCD): ${formData.useNPS}

RETIREMENT:
- Current Age: ${formData.currentAge || 'Not provided'}
- Target Retirement Age: ${formData.targetRetirementAge || '60'}
- Current Retirement Corpus: ₹${formData.retirementCorpus || '0'}

Please analyze this data and provide scores across 6 dimensions with personalized recommendations.`

    try {
      const data = await fetchHealthAnalysis(prompt)
      if (data.error) throw new Error(data.error)
      setResults(data)
      setStep('results')
    } catch (err) {
      console.error('Health score API error:', err)
      setError(err.message || 'AI analysis failed. Please try again.')
      setStep('form')
    }
  }

  return (
    <section id="health" className="py-24 relative">
      <div className="absolute inset-0 grid-dot-bg opacity-20 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="section-tag mx-auto mb-4">
            <Activity size={11} />
            Money Health Score
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-navy-900">
            Your Financial <span className="gradient-text">Vital Signs</span>
          </h2>
          <p className="mt-4 text-navy-900/50 max-w-xl mx-auto text-base leading-relaxed">
            Our AI analyzes your financial data to give you a personalized score across 6 critical dimensions with actionable recommendations.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── FORM STATE ── */}
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="glass-card p-6 sm:p-8">
                {/* Progress */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-navy-900/45">
                    Step {formPage + 1} of {formPages.length}
                  </span>
                  <span className="text-xs font-bold text-navy-900">
                    {formPages[formPage].title}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-navy-900/10 rounded-full overflow-hidden mb-6">
                  <motion.div
                    className="h-full bg-navy-900 rounded-full"
                    animate={{ width: `${((formPage + 1) / formPages.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Current form page */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={formPage}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {formPages[formPage].fields}
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-navy-900/[0.06]">
                  <button
                    onClick={() => setFormPage(p => p - 1)}
                    disabled={formPage === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-navy-900/10 text-navy-900/50 hover:bg-navy-900/[0.03] transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>

                  {formPage < formPages.length - 1 ? (
                    <button
                      onClick={() => setFormPage(p => p + 1)}
                      className="btn-primary flex items-center gap-1.5 text-sm"
                    >
                      Continue <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={handleAnalyze}
                      className="btn-primary flex items-center gap-2 text-sm"
                    >
                      <Sparkles size={14} />
                      Analyze with AI
                    </button>
                  )}
                </div>

                {error && (
                  <p className="mt-3 text-xs text-red-500 text-center">{error}</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── LOADING STATE ── */}
          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-20 h-20 rounded-full bg-navy-900/[0.05] flex items-center justify-center mb-6">
                <Loader2 size={36} className="text-navy-900/40 animate-spin" />
              </div>
              <p className="text-lg font-semibold text-navy-900 mb-2">AI is analyzing your finances…</p>
              <p className="text-sm text-navy-900/40">Scoring 6 dimensions with personalized insights</p>
            </motion.div>
          )}

          {/* ── RESULTS STATE ── */}
          {step === 'results' && results && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="grid lg:grid-cols-3 gap-6 items-start">
                {/* Col 1: Overall + dimensions */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className="glass-card p-6 space-y-5"
                >
                  <div className="text-center py-4">
                    <div className="relative inline-flex items-center justify-center w-28 h-28 mx-auto mb-3">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(10,25,47,0.06)" strokeWidth="8" />
                        <motion.circle
                          cx="50" cy="50" r="44"
                          fill="none"
                          stroke="#0A192F"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 44}`}
                          initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - (results.overall || 0) / 100) }}
                          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-extrabold text-navy-900">{results.overall || 0}</span>
                        <span className="text-xs text-navy-900/40">/100</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-navy-900">Overall Score</p>
                    <p className="text-xs text-amber-600 font-medium mt-0.5">{results.overallLabel || 'Needs Attention'}</p>
                  </div>

                  <div className="space-y-3">
                    {(results.dimensions || []).map(d => (
                      <div key={d.label} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-navy-900/55">{d.label}</span>
                          <span className="text-xs font-bold" style={{ color: d.color }}>{d.value}</span>
                        </div>
                        <ScoreBar value={d.value} color={d.color} />
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Col 2: Radar chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                  className="glass-card p-6 flex flex-col items-center"
                >
                  <p className="text-sm font-semibold text-navy-900/70 mb-4 self-start">Dimension Radar</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart cx="50%" cy="50%" outerRadius="72%" data={results.dimensions || []}>
                      <PolarGrid stroke="rgba(10,25,47,0.08)" />
                      <PolarAngleAxis
                        dataKey="dimension"
                        tick={{ fill: 'rgba(10,25,47,0.5)', fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                      />
                      <Radar
                        name="Score"
                        dataKey="value"
                        stroke="#0A192F"
                        fill="#0A192F"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 w-full p-3 rounded-xl bg-navy-900/[0.04] border border-navy-900/[0.08] text-center">
                    <p className="text-xs text-navy-900/45">Biggest opportunity</p>
                    <p className="text-sm font-bold text-navy-900 mt-0.5">{results.biggestOpportunity || '—'}</p>
                  </div>
                </motion.div>

                {/* Col 3: AI Recommendations */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 }}
                  className="glass-card p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-navy-900/40" />
                    <p className="text-sm font-semibold text-navy-900/70">AI Recommendations</p>
                  </div>

                  {(results.recommendations || []).map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06] space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.color}`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                      <p className="text-xs text-navy-900/45 leading-relaxed">{item.detail}</p>
                    </div>
                  ))}

                  <button
                    onClick={() => { setStep('form'); setFormPage(0); setResults(null) }}
                    className="btn-primary w-full justify-center text-sm mt-2"
                  >
                    Re-Analyze My Finances
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
