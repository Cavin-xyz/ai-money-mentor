import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import { Activity, Sparkles, ChevronRight, ChevronLeft, UserRound, Info } from 'lucide-react'
import { useAdvisorStream } from '../hooks/useAdvisorStream'
import { useProfile, profileValues } from '../context/ProfileContext'
import PipelineProgress from './trust/PipelineProgress'
import ResultFooter from './trust/ResultFooter'

const PROFILE_MAP = {
  monthlyIncome: 'monthlyIncome', monthlyExpenses: 'monthlyExpenses', liquidSavings: 'liquidSavings',
  dependents: 'dependents', lifeCover: 'lifeCover', healthCover: 'healthCover', monthlyEmi: 'monthlyEmi',
  equityPct: 'equityPct', currentAge: 'age', targetRetirementAge: 'retirementAge', retirementCorpus: 'retirementCorpus',
}

const LABEL_COLOR = { Excellent: 'text-emerald-600', Good: 'text-emerald-600', 'Needs Attention': 'text-amber-600', Critical: 'text-red-600' }

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

export default function MoneyHealthScore() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const { profile, hasProfile, restoreRequest, refresh } = useProfile()
  const stream = useAdvisorStream('/api/health-score/stream')
  const [formPage, setFormPage] = useState(0)
  const [openFormula, setOpenFormula] = useState(null)
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
  const [error, setError] = useState(null)
  const { restore, status } = stream
  useEffect(() => {
    if (restoreRequest?.module === 'health-score') {
      restore(restoreRequest.result)
      document.getElementById('health')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [restoreRequest, restore])
  useEffect(() => {
    if (status === 'done') refresh()
  }, [status, refresh])
  const results = stream.data
  const showResults = stream.status !== 'idle'
  const pending = stream.running && !stream.result

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

  const handleAnalyze = () => {
    if (!formData.monthlyIncome || !formData.monthlyExpenses) {
      setError('Please enter at least your monthly income and expenses.')
      setFormPage(0)
      return
    }
    setError(null)
    stream.run(formData)
  }

  return (
    <section id="health" className="py-24 relative scroll-mt-20">
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
            Six dimensions scored by visible formulas, not AI guesses. Tap any score to see exactly how it was computed.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── FORM STATE ── */}
          {!showResults && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="glass-card p-6 sm:p-8">
                {hasProfile && (
                  <button onClick={() => setFormData((p) => ({ ...p, ...profileValues(profile, PROFILE_MAP) }))} className="mb-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-navy-900/[0.04] border border-navy-900/10 text-xs font-semibold text-navy-900/70 hover:bg-navy-900/[0.07]">
                    <UserRound size={13} /> Use my saved numbers
                  </button>
                )}
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
                      Score my finances
                    </button>
                  )}
                </div>

                {error && (
                  <p className="mt-3 text-xs text-red-500 text-center">{error}</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── RESULTS STATE ── */}
          {showResults && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="max-w-3xl mx-auto">
                <PipelineProgress stages={stream.stages} status={stream.status} citations={stream.citations} trust={stream.result?.meta?.trust} />
              </div>
              {stream.status === 'error' && (
                <div className="glass-card p-5 text-center max-w-3xl mx-auto">
                  <p className="text-sm text-red-600">{stream.error}</p>
                  <button onClick={() => stream.reset()} className="btn-ghost mt-3 text-xs">Back to the form</button>
                </div>
              )}
              {results && (<>
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
                          stroke={results.overallColor || '#0A192F'}
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
                    <p className={`text-xs font-semibold mt-0.5 ${LABEL_COLOR[results.overallLabel] || 'text-navy-900/60'}`}>{results.overallLabel}</p>
                    <p className="text-[10px] text-navy-900/35 mt-1">Weighted: {(results.dimensions || []).map((d) => `${d.dimension} ${d.weight}%`).join(' · ')}</p>
                  </div>

                  <div className="space-y-3">
                    {(results.dimensions || []).map(d => (
                      <div key={d.label} className="space-y-1.5">
                        <button onClick={() => setOpenFormula(openFormula === d.label ? null : d.label)} className="w-full flex justify-between items-center text-left" aria-expanded={openFormula === d.label}>
                          <span className="text-xs text-navy-900/55 flex items-center gap-1">{d.label} <Info size={11} className="text-navy-900/30" /></span>
                          <span className="text-xs font-bold" style={{ color: d.color }}>{d.value}</span>
                        </button>
                        <ScoreBar value={d.value} color={d.color} />
                        {openFormula === d.label && (
                          <div className="text-[11px] p-2.5 rounded-lg bg-navy-900/[0.03] border border-navy-900/[0.06] space-y-0.5">
                            <p className="font-mono text-navy-900/70">{d.formula}</p>
                            <p className="text-navy-900/50">{d.desc}</p>
                          </div>
                        )}
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
                    <p className="text-sm font-semibold text-navy-900/70">Recommendations</p>
                  </div>

                  {(results.recommendations || []).map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06] space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.color}`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                      <p className={`text-xs text-navy-900/45 leading-relaxed ${pending ? 'animate-pulse' : ''}`}>{item.detail}</p>
                    </div>
                  ))}

                  <button
                    onClick={() => { stream.reset(); setFormPage(0) }}
                    className="btn-primary w-full justify-center text-sm mt-2"
                  >
                    Re-Analyze My Finances
                  </button>
                </motion.div>
              </div>
              <div className="max-w-3xl mx-auto">
                <ResultFooter
                  meta={results.meta}
                  citations={stream.citations}
                  pending={pending}
                  module="health-score"
                  askContext={`Health score ${results.overall}/100 (${results.overallLabel}); biggest opportunity: ${results.biggestOpportunity}`}
                  suggestions={['How much term insurance do I need?', 'Is 80D available in the new regime?', 'What counts as an emergency fund?']}
                />
              </div>
              </>)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
