import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip
} from 'recharts'
import {
  Sparkles, Gift, Heart, Baby, Briefcase, Home, Landmark, PiggyBank,
  ArrowRight, Download, CalendarSync, Check, Square, Shield,
  TrendingUp, Flame, HelpCircle, Archive, ChevronRight, Loader2
} from 'lucide-react'
import { postJson } from '../lib/api'

/* ─── Life Events Config ─────────────────────────────────────────────────── */
const LIFE_EVENTS = [
  {
    id: 'bonus',
    label: 'I received a Bonus',
    icon: Gift,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    prompt: (amount) => `I'm an Indian salaried professional and I just received a bonus of ₹${amount}. Analyze the tax impact and give me a structured financial strategy.`,
    defaultAmount: '5,00,000',
  },
  {
    id: 'marriage',
    label: 'Getting Married',
    icon: Heart,
    color: 'text-pink-600 bg-pink-50 border-pink-200',
    prompt: (amount) => `I'm getting married in India with an estimated budget of ₹${amount}. Give me a complete financial advisory covering budget optimization, tax implications after marriage (HRA, joint investments), and wealth planning as a couple.`,
    defaultAmount: '15,00,000',
  },
  {
    id: 'baby',
    label: 'New Baby',
    icon: Baby,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    prompt: (amount) => `I'm an Indian parent expecting a new baby. My current monthly income is ₹${amount}. Advise me on insurance needs (term + health), child education planning (Sukanya/PPF), emergency fund adjustment, and tax-efficient savings.`,
    defaultAmount: '1,50,000',
  },
  {
    id: 'inheritance',
    label: 'Inheritance',
    icon: Landmark,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    prompt: (amount) => `I've received an inheritance of ₹${amount} in India. Advise on tax implications (capital gains, property), optimal asset allocation, debt clearance strategy, and how to integrate this into my FIRE plan.`,
    defaultAmount: '50,00,000',
  },
  {
    id: 'job_change',
    label: 'Job Change',
    icon: Briefcase,
    color: 'text-violet-600 bg-violet-50 border-violet-200',
    prompt: (amount) => `I'm changing jobs in India with a new CTC of ₹${amount}. Advise on EPF transfer vs withdrawal, gratuity eligibility, salary structuring for tax efficiency (HRA, NPS, LTA), and how to optimize the new compensation.`,
    defaultAmount: '25,00,000',
  },
  {
    id: 'home',
    label: 'Home Purchase',
    icon: Home,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    prompt: (amount) => `I'm buying a home in India worth ₹${amount}. Advise on home loan optimization (tenure, EMI vs SIP), Section 80C/24b deductions, stamp duty, registration, and impact on my overall financial plan.`,
    defaultAmount: '80,00,000',
  },
]



/* ─── Backend API ─────────────────────────────────────────────────────────── */
function fetchAdvisory(prompt) {
  return postJson('/api/life-event/advise', { prompt })
}

/* No fallback data — all results come from AI */

/* ─── Chart Tooltip ───────────────────────────────────────────────────────── */
const BarTooltipCustom = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-navy-900/10 shadow-lg rounded-xl px-3 py-2 text-xs">
      <p className="text-navy-900/50">{label}</p>
      <p className="text-navy-900 font-bold">{payload[0].value} pts</p>
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function LifeEventAdvisor() {
  const [selectedEvent, setSelectedEvent] = useState(LIFE_EVENTS[0])
  const [amount, setAmount] = useState(LIFE_EVENTS[0].defaultAmount)
  const [advisory, setAdvisory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checkedItems, setCheckedItems] = useState({})
  const [error, setError] = useState(null)

  const handleSelectEvent = (event) => {
    setSelectedEvent(event)
    setAmount(event.defaultAmount)
    setAdvisory(null)
    setCheckedItems({})
    setError(null)
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setAdvisory(null)

    try {
      const prompt = selectedEvent.prompt(amount)
      const data = await fetchAdvisory(prompt)
      if (data.error) throw new Error(data.error)
      setAdvisory(data)
      setCheckedItems({})
    } catch (err) {
      console.error('Advisory API error:', err)
      setError(err.message || 'AI analysis failed. Please check that the backend is running and try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleCheck = (i) => {
    setCheckedItems(prev => ({ ...prev, [i]: !prev[i] }))
  }

  const chartData = useMemo(() => {
    if (!advisory?.healthImpact?.quarterData) return []
    const labels = ['Q1', 'Q2', 'Q3', 'Q4', 'Now']
    return advisory.healthImpact.quarterData.map((val, i) => ({
      quarter: labels[i] || `Q${i + 1}`,
      score: val,
      isNow: i === advisory.healthImpact.quarterData.length - 1,
    }))
  }, [advisory])

  return (
    <section id="advisor" className="py-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-10">
          <div className="section-tag mb-4">
            <Sparkles size={11} />
            AI Advisory
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Life Event Financial Advisor
          </h1>
          <p className="text-navy-900/50 text-base mt-2 max-w-2xl">
            Institutional-grade advice for life's biggest milestones. Our AI engine processes
            Indian tax laws and market conditions to secure your legacy.
          </p>
        </div>

        <div>
          {/* ── Main Content ── */}
          <div className="max-w-5xl mx-auto space-y-5">
            {/* Event Selection + API Key */}
            <div className="grid lg:grid-cols-5 gap-5">
              {/* Select Milestone */}
              <div className="lg:col-span-2 glass-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900 mb-4">
                  <Sparkles size={14} className="text-navy-900/40" />
                  Select Active Milestone
                </h2>

                <div className="space-y-2">
                  {LIFE_EVENTS.map(event => {
                    const Icon = event.icon
                    const isSelected = selectedEvent.id === event.id
                    return (
                      <button
                        key={event.id}
                        onClick={() => handleSelectEvent(event)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-navy-900 bg-navy-900 text-white shadow-md'
                            : 'border-navy-900/[0.08] bg-white text-navy-900/70 hover:border-navy-900/20 hover:bg-navy-900/[0.02]'
                        }`}
                      >
                        <Icon size={16} className={isSelected ? 'text-white/80' : 'text-navy-900/40'} />
                        {event.label}
                        {isSelected && <Check size={14} className="ml-auto text-white/80" />}
                      </button>
                    )
                  })}
                </div>

                {/* Amount input */}
                <div className="mt-4 pt-4 border-t border-navy-900/[0.06]">
                  <label className="text-xs font-semibold text-navy-900/45 uppercase tracking-wider">Amount (₹)</label>
                  <input
                    type="text"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full mt-2 bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-3 text-navy-900 font-bold text-lg focus:outline-none focus:border-navy-900/30 font-mono"
                    placeholder="5,00,000"
                  />
                </div>



                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate AI Advisory
                    </>
                  )}
                </button>

                {error && (
                  <p className="mt-2 text-xs text-amber-600 text-center">{error}</p>
                )}
              </div>

              {/* Advisory Result */}
              <div className="lg:col-span-3">
                <AnimatePresence mode="wait">
                  {!advisory && !loading ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="glass-card p-10 flex flex-col items-center justify-center min-h-[400px] text-center"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-navy-900/[0.05] border border-navy-900/10 flex items-center justify-center mb-5">
                        <Sparkles size={28} className="text-navy-900/25" />
                      </div>
                      <h3 className="text-lg font-bold text-navy-900/60 mb-2">Select a Life Event & Analyze</h3>
                      <p className="text-sm text-navy-900/35 max-w-sm leading-relaxed">
                        Choose a milestone from the left, enter the amount, and our
                        Gemini-powered AI will generate a personalized financial strategy.
                      </p>
                    </motion.div>
                  ) : loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="glass-card p-10 flex flex-col items-center justify-center min-h-[400px] text-center"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-navy-900/[0.06] border border-navy-900/10 flex items-center justify-center mb-5 relative">
                        <Sparkles size={28} className="text-navy-900/40" />
                        <motion.div
                          className="absolute inset-0 rounded-2xl border-2 border-navy-900/20"
                          animate={{ scale: [1, 1.25, 1], opacity: [1, 0, 1] }}
                          transition={{ repeat: Infinity, duration: 1.4 }}
                        />
                      </div>
                      <h3 className="text-lg font-bold text-navy-900/70 mb-2">AI Analyzing Your Event…</h3>
                      <div className="space-y-2 text-left mt-4">
                        {[
                          'Processing tax implications…',
                          'Evaluating asset allocation…',
                          'Calculating FIRE impact…',
                          'Generating advisory…',
                        ].map((step, i) => (
                          <motion.div
                            key={step}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.5 }}
                            className="flex items-center gap-2 text-xs text-navy-900/50"
                          >
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full bg-navy-900"
                              animate={{ scale: [1, 1.5, 1] }}
                              transition={{ delay: i * 0.5, repeat: 1, duration: 0.4 }}
                            />
                            {step}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : advisory ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-5"
                    >
                      {/* Advisory Header */}
                      <div className="glass-card p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1.5">AI Generated Advisory</p>
                            <h2 className="text-2xl font-extrabold text-navy-900 leading-snug">
                              {advisory.headline}
                            </h2>
                          </div>
                          <div className="flex-shrink-0 px-4 py-3 rounded-xl border border-navy-900/10 bg-navy-900/[0.02] text-center">
                            <p className="text-2xl font-extrabold text-navy-900">{advisory.confidence}%</p>
                            <p className="text-[9px] text-navy-900/40 font-medium">Strategy<br/>Confidence</p>
                          </div>
                        </div>
                      </div>

                      {/* Actions Grid */}
                      <div className="grid md:grid-cols-2 gap-5">
                        {/* Immediate Actions */}
                        <div className="glass-card p-5">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900 mb-4">
                            <ChevronRight size={14} className="text-navy-900/40" />
                            Immediate Actions
                          </h3>
                          <div className="space-y-3">
                            {advisory.immediateActions?.map((action, i) => (
                              <div key={i} className="p-3.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06] hover:border-navy-900/15 transition-colors">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p className="text-sm font-semibold text-navy-900">{action.title}</p>
                                  <span className="text-sm font-bold text-navy-900 flex-shrink-0">{action.amount}</span>
                                </div>
                                <p className="text-xs text-navy-900/45 leading-relaxed">{action.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Long-term Allocation */}
                        <div className="glass-card p-5">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900 mb-4">
                            <TrendingUp size={14} className="text-navy-900/40" />
                            Long-term Allocation
                          </h3>
                          <div className="space-y-3">
                            {advisory.longTermAllocation?.map((item, i) => (
                              <div key={i} className="p-3.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06] hover:border-navy-900/15 transition-colors">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                                  <span className="text-sm font-bold text-navy-900 flex-shrink-0">{item.amount}</span>
                                </div>
                                <p className="text-xs text-navy-900/45 leading-relaxed">{item.description}</p>
                              </div>
                            ))}
                          </div>

                          {/* FIRE Impact */}
                          {advisory.fireImpact && (
                            <div className="mt-4 p-3 rounded-xl bg-navy-900/[0.04] border border-navy-900/10 flex items-start gap-2.5">
                              <Flame size={14} className="text-navy-900/50 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-[10px] font-bold text-navy-900/50 uppercase tracking-wider mb-0.5">FIRE Impact</p>
                                <p className="text-xs text-navy-900/65 leading-relaxed">{advisory.fireImpact}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>



            {/* Disclaimer */}
            {advisory && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center"
              >
                <p className="text-[10px] text-navy-900/25 mt-2">
                  EDITORIAL INTELLIGENCE INSTITUTIONAL REPORT · Investment recommendations are based on
                  your risk profile 'Aggressive Growth'. Tax calculations are estimates based on FY2024-25
                  regulations. Consult your local chartered accountant for final verification.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
