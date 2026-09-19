import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Sparkles, Loader2, RefreshCw
} from 'lucide-react'
import { postJson } from '../lib/api'

const SLAB_OPTIONS = ['0', '5', '10', '15', '20', '25', '30']

const defaultPartner = (name) => ({
  name,
  salary: '',
  slab: '30',
  declarations80C: '',
  investments: '',
})

function fetchCoupleInsights(prompt) {
  return postJson('/api/couples-planner/insights', { prompt })
}

function ImpactBadge({ type, label }) {
  const styles = {
    high: 'bg-red-50 text-red-600 border-red-200',
    retirement: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    portfolio: 'bg-blue-50 text-blue-600 border-blue-200',
  }
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${styles[type] || styles.high}`}>
      {label}
    </span>
  )
}

const inputClass = "w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-2.5 text-sm text-navy-900 font-bold font-mono focus:outline-none focus:border-navy-900/30 transition-all placeholder-navy-900/25"

export default function CouplesMoneyPlanner() {
  const [partners, setPartners] = useState({
    partner1: defaultPartner('Partner 1'),
    partner2: defaultPartner('Partner 2'),
  })
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const updatePartner = useCallback((key, field, value) => {
    setPartners(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }, [])

  const handleGenerateInsights = async () => {
    const p1 = partners.partner1
    const p2 = partners.partner2

    if (!p1.salary || !p2.salary) {
      setError('Please enter salary for both partners')
      return
    }

    setLoading(true)
    setError(null)

    const prompt = `
Given these two partners' financial data:
Partner 1 - ${p1.name}: Monthly Salary ₹${p1.salary}, Tax Slab ${p1.slab}%, 80C Declarations ₹${p1.declarations80C || '0'}, Investments ₹${p1.investments || '0'}/month
Partner 2 - ${p2.name}: Monthly Salary ₹${p2.salary}, Tax Slab ${p2.slab}%, 80C Declarations ₹${p2.declarations80C || '0'}, Investments ₹${p2.investments || '0'}/month
Generate exactly 3 cross-income optimization insights as a JSON array.`

    try {
      const data = await fetchCoupleInsights(prompt)
      if (data.error) throw new Error(data.error)
      setInsights(Array.isArray(data) ? data : null)
      if (!Array.isArray(data)) {
        setError('Unexpected AI response. Please try again.')
      }
    } catch (err) {
      console.error('Couple planner API error:', err)
      setError(err.message || 'AI analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="couples" className="py-16 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="section-tag mx-auto mb-4">
            <Users size={11} />
            Collaborative Suite
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Couple's Money Planner
          </h1>
          <p className="text-navy-900/50 text-base mt-2 max-w-xl mx-auto">
            Enter both partners' financial details and let AI optimize your cross-income tax benefits and investment strategies.
          </p>
        </div>

        {/* Financial Input Form */}
        <div className="glass-card p-6 sm:p-8 mb-6">
          <h2 className="text-base font-bold text-navy-900 mb-6">Financial Profile Input</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {['partner1', 'partner2'].map((key, idx) => {
              const p = partners[key]
              const avatarColor = idx === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              return (
                <div key={key}>
                  {/* Partner Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center font-bold text-sm`}>
                      {p.name.charAt(0)}
                    </div>
                    <input
                      type="text"
                      value={p.name}
                      onChange={e => updatePartner(key, 'name', e.target.value)}
                      className="text-sm font-bold text-navy-900 bg-transparent border-none p-0 focus:outline-none w-32"
                      placeholder="Enter name"
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-navy-900/40 uppercase tracking-wider">Monthly Base Salary</label>
                      <div className="mt-1 flex items-center bg-navy-900/[0.03] border border-navy-900/10 rounded-xl overflow-hidden">
                        <span className="pl-3 text-sm text-navy-900/40 font-mono">₹</span>
                        <input type="text" value={p.salary} onChange={e => updatePartner(key, 'salary', e.target.value)} className="w-full bg-transparent px-2 py-2.5 text-sm text-navy-900 font-bold font-mono focus:outline-none" placeholder="e.g. 120000" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-navy-900/40 uppercase tracking-wider">Individual Investments/mo</label>
                      <div className="mt-1 flex items-center bg-navy-900/[0.03] border border-navy-900/10 rounded-xl overflow-hidden">
                        <span className="pl-3 text-sm text-navy-900/40 font-mono">₹</span>
                        <input type="text" value={p.investments} onChange={e => updatePartner(key, 'investments', e.target.value)} className="w-full bg-transparent px-2 py-2.5 text-sm text-navy-900 font-bold font-mono focus:outline-none" placeholder="e.g. 25000" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-navy-900/40 uppercase tracking-wider">Tax Declarations (80C)</label>
                      <div className="mt-1 flex items-center bg-navy-900/[0.03] border border-navy-900/10 rounded-xl overflow-hidden">
                        <span className="pl-3 text-sm text-navy-900/40 font-mono">₹</span>
                        <input type="text" value={p.declarations80C} onChange={e => updatePartner(key, 'declarations80C', e.target.value)} className="w-full bg-transparent px-2 py-2.5 text-sm text-navy-900 font-bold font-mono focus:outline-none" placeholder="e.g. 150000" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-navy-900/40 uppercase tracking-wider">Tax Slab</label>
                      <select value={p.slab} onChange={e => updatePartner(key, 'slab', e.target.value)} className="mt-1 w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-3 py-2.5 text-sm text-navy-900 font-bold focus:outline-none appearance-none">
                        {SLAB_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}%</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateInsights}
            disabled={loading}
            className="btn-primary w-full mt-6 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate AI Cross-Income Strategy
              </>
            )}
          </button>

          {error && (
            <p className="mt-3 text-xs text-red-500 text-center">{error}</p>
          )}
        </div>

        {/* AI Insights Results */}
        <AnimatePresence>
          {insights && insights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 sm:p-8"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-navy-900/40" />
                  <h2 className="text-base font-bold text-navy-900">AI Strategy Insights</h2>
                </div>
                <button
                  onClick={handleGenerateInsights}
                  disabled={loading}
                  className="p-1.5 rounded-lg hover:bg-navy-900/[0.05] transition-colors text-navy-900/40 hover:text-navy-900"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </div>

              <div className="space-y-3">
                {insights.map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-[10px] font-bold text-navy-900/50 uppercase tracking-wider">{item.category}</p>
                      <ImpactBadge type={item.impactType} label={item.impactLabel} />
                    </div>
                    <p className="text-sm text-navy-900/65 leading-relaxed">{item.insight}</p>
                    {item.estimatedSaving && (
                      <p className="text-xs font-bold text-emerald-600 mt-2">
                        Est. Savings: {item.estimatedSaving}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Disclaimer */}
        <p className="text-center text-navy-900/25 text-[10px] mt-6">
          * Couple's planner recommendations are based on combined financial profiles and Indian tax regulations (FY 2024-25).
          Cross-income optimizations are estimates. Consult your chartered accountant for final verification.
        </p>
      </div>
    </section>
  )
}
