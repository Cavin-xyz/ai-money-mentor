import { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  ScanSearch, Upload, FileText, Sparkles, Loader2, X,
  TrendingUp, PieChart, BarChart3, AlertTriangle, ArrowRightLeft,
  DollarSign, Heart, Zap, Layers, Target, ShieldCheck
} from 'lucide-react'

/* ── API helper ── */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

async function fetchPortfolioAnalysis(prompt, inlineData) {
  const body = { prompt }
  if (inlineData) body.inlineData = inlineData

  const response = await fetch(`${API_URL}/api/portfolio/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.error || `HTTP error! Status: ${response.status}`)
  }
  const text = data.response || ''
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

/* ── Stagger helper ── */
const anim = (i) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.3 },
})

/* ── Priority badge colors ── */
const priorityColor = {
  Critical: 'bg-red-50 text-red-600 border-red-100',
  High: 'bg-orange-50 text-orange-600 border-orange-100',
  Medium: 'bg-amber-50 text-amber-600 border-amber-100',
}

/* ── Rating badge colors ── */
const ratingColor = {
  Good: 'bg-emerald-50 text-emerald-600',
  Average: 'bg-amber-50 text-amber-600',
  Poor: 'bg-red-50 text-red-600',
}

export default function PortfolioXRay() {
  const ref = useRef(null)
  const fileInputRef = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const [step, setStep] = useState('upload')  // upload | scanning | results
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileData, setFileData] = useState(null)
  const [manualFunds, setManualFunds] = useState('')
  const [mode, setMode] = useState('file') // file | manual

  /* ── File handling ── */
  const processFile = (file) => {
    if (!file) return
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or image file (PNG, JPG, WEBP).')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large. Max 20MB.')
      return
    }
    setError(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      setFileData({ mimeType: file.type, data: base64 })
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  const handleAnalyze = async () => {
    if (mode === 'file' && !fileData) {
      setError('Please upload your CAMS/KFintech statement first.')
      return
    }
    if (mode === 'manual' && !manualFunds.trim()) {
      setError('Please enter your fund holdings.')
      return
    }

    setStep('scanning'); setError(null)

    const prompt = mode === 'file'
      ? `Analyze this CAMS/KFintech mutual fund statement. Extract every fund holding with current values, and provide a complete portfolio X-Ray with allocation, overlap, expense analysis, benchmark comparison, and rebalancing recommendations.`
      : `Analyze this mutual fund portfolio for an Indian investor:\n\n${manualFunds}\n\nProvide complete portfolio X-Ray.`

    try {
      const result = await fetchPortfolioAnalysis(prompt, mode === 'file' ? fileData : null)
      setPlan(result)
      setStep('results')
    } catch (err) {
      console.error('Portfolio X-Ray error:', err)
      setError(err.message || 'AI analysis failed. Please try again.')
      setStep('upload')
    }
  }

  const reset = () => {
    setStep('upload'); setPlan(null); setFileName(''); setFileData(null); setManualFunds(''); setError(null)
  }

  return (
    <section id="xray" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 grid-dot-bg opacity-20 pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="section-tag mx-auto mb-4">
            <ScanSearch size={11} />
            MF Portfolio X-Ray
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-navy-900">
            Portfolio <span className="gradient-text">Reconstruction</span>
          </h2>
          <p className="mt-4 text-navy-900/50 max-w-2xl mx-auto text-base leading-relaxed">
            Upload your CAMS or KFintech statement and get instant AI-powered analysis — fund overlap, expense audit, XIRR, benchmark comparison, and a rebalancing plan.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── UPLOAD STATE ── */}
          {step === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="glass-card p-6 sm:p-8 max-w-2xl mx-auto">

                {/* Mode toggle */}
                <div className="flex rounded-xl bg-navy-900/[0.04] p-1 mb-6">
                  <button
                    onClick={() => setMode('file')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${mode === 'file' ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-900/40 hover:text-navy-900/60'}`}
                  >
                    <Upload size={13} /> Upload Statement
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${mode === 'manual' ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-900/40 hover:text-navy-900/60'}`}
                  >
                    <FileText size={13} /> Enter Manually
                  </button>
                </div>

                {mode === 'file' ? (
                  <>
                    {/* Drop zone */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                        dragging
                          ? 'border-navy-900/40 bg-navy-900/[0.06]'
                          : fileName
                            ? 'border-emerald-300 bg-emerald-50/50'
                            : 'border-navy-900/15 hover:border-navy-900/30 hover:bg-navy-900/[0.02]'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={e => processFile(e.target.files[0])}
                      />

                      {fileName ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <ShieldCheck size={22} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-navy-900">{fileName}</p>
                            <p className="text-xs text-emerald-600 font-medium">Ready to analyze</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setFileName(''); setFileData(null) }}
                            className="text-xs text-navy-900/40 hover:text-red-500 transition-colors flex items-center gap-1"
                          >
                            <X size={12} /> Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-navy-900/[0.06] border border-navy-900/10 flex items-center justify-center">
                            <Upload size={24} className="text-navy-900/50" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-navy-900 mb-1">
                              Drop your CAMS/KFintech statement here
                            </p>
                            <p className="text-xs text-navy-900/40">
                              PDF or image · Max 20MB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Manual entry */
                  <div>
                    <label className="block text-xs font-semibold text-navy-900/50 uppercase tracking-wider mb-2">Fund Holdings</label>
                    <textarea
                      value={manualFunds}
                      onChange={e => setManualFunds(e.target.value)}
                      className="w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-3 text-sm text-navy-900 focus:outline-none focus:border-navy-900/30 focus:ring-1 focus:ring-navy-900/15 transition-all placeholder-navy-900/25 min-h-[160px] font-mono resize-none"
                      placeholder={`e.g.\nHDFC Top 100 — ₹3,00,000\nMirae Asset Emerging Bluechip — ₹2,50,000\nSBI Small Cap — ₹1,50,000\nParag Parikh Flexi Cap — ₹2,00,000`}
                    />
                  </div>
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={(mode === 'file' && !fileData) || (mode === 'manual' && !manualFunds.trim())}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm mt-5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ScanSearch size={14} />
                  Run Portfolio X-Ray
                </button>

                {error && <p className="mt-3 text-xs text-red-500 text-center">{error}</p>}
                <p className="text-center text-[10px] text-navy-900/25 mt-3">Your data is processed by AI and never stored.</p>
              </div>
            </motion.div>
          )}

          {/* ── SCANNING STATE ── */}
          {step === 'scanning' && (
            <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-navy-900/[0.05] flex items-center justify-center mb-6 relative">
                <ScanSearch size={32} className="text-navy-900/40" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-navy-900/20"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              </div>
              <p className="text-lg font-semibold text-navy-900 mb-2">Scanning your portfolio…</p>
              <p className="text-sm text-navy-900/40">Extracting funds, analyzing overlap & expenses</p>
            </motion.div>
          )}

          {/* ── RESULTS STATE ── */}
          {step === 'results' && plan && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* ─ Hero Stats ─ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Portfolio Value', value: plan.portfolioValue, icon: <DollarSign size={14} className="text-emerald-500" /> },
                  { label: 'Est. XIRR', value: plan.estimatedXIRR, icon: <TrendingUp size={14} className="text-cyan-600" /> },
                  { label: 'Health Score', value: plan.healthScore, icon: <Heart size={14} className="text-rose-500" /> },
                  { label: 'Expense Drag', value: plan.expenseDrag, icon: <Zap size={14} className="text-amber-500" /> },
                ].map((s, i) => (
                  <motion.div key={i} {...anim(i)} className="glass-card p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      {s.icon}
                      <span className="text-[9px] font-bold text-navy-900/40 uppercase tracking-wider">{s.label}</span>
                    </div>
                    <p className="text-lg font-extrabold text-navy-900 leading-tight">{s.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* ─ Asset Allocation ─ */}
              {plan.allocation?.length > 0 && (
                <motion.div {...anim(4)} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center"><PieChart size={14} className="text-blue-500" /></div>
                    <h3 className="text-sm font-bold text-navy-900">Asset Allocation</h3>
                  </div>
                  {/* Visual bar */}
                  <div className="flex h-3 rounded-full overflow-hidden mb-4">
                    {plan.allocation.map((a, i) => {
                      const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-400', 'bg-purple-500', 'bg-rose-400']
                      return <div key={i} className={`${colors[i % colors.length]}`} style={{ width: a.percentage }} />
                    })}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {plan.allocation.map((a, i) => {
                      const dotColors = ['bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-400', 'bg-purple-500', 'bg-rose-400']
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-navy-900/[0.02]">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColors[i % dotColors.length]}`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-navy-900 block truncate">{a.category}</span>
                            <span className="text-[10px] text-navy-900/40">{a.percentage} · {a.value}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* ─ Fund Holdings ─ */}
              {plan.funds?.length > 0 && (
                <motion.div {...anim(5)} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center"><Layers size={14} className="text-indigo-500" /></div>
                    <h3 className="text-sm font-bold text-navy-900">Fund Holdings ({plan.totalFunds || plan.funds.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {plan.funds.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-xs font-bold text-navy-900 truncate">{f.name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ratingColor[f.rating] || 'bg-gray-50 text-gray-500'}`}>{f.rating}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-navy-900/40">
                            <span>{f.category}</span>
                            <span>ER: {f.expenseRatio}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-extrabold text-navy-900">{f.currentValue}</span>
                          <p className="text-[10px] text-navy-900/35 truncate max-w-[140px]">{f.remark}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─ Overlap + Benchmark (side by side) ─ */}
              <div className="grid sm:grid-cols-2 gap-5">
                {/* Overlap */}
                {plan.overlap?.length > 0 && (
                  <motion.div {...anim(6)} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center"><AlertTriangle size={14} className="text-red-500" /></div>
                      <h3 className="text-sm font-bold text-navy-900">Stock Overlap</h3>
                    </div>
                    <div className="space-y-2">
                      {plan.overlap.map((o, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                          <div>
                            <span className="text-xs font-bold text-navy-900">{o.stock}</span>
                            <p className="text-[10px] text-navy-900/35">{o.funds} · {o.exposure}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            o.risk === 'HIGH' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>{o.risk}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Benchmark */}
                {plan.benchmarkComparison && (
                  <motion.div {...anim(7)} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center"><BarChart3 size={14} className="text-cyan-600" /></div>
                      <h3 className="text-sm font-bold text-navy-900">vs Nifty 50</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                        <span className="text-xs text-navy-900/50">Your Portfolio</span>
                        <span className="text-sm font-extrabold text-navy-900">{plan.benchmarkComparison.portfolioReturn}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                        <span className="text-xs text-navy-900/50">Nifty 50</span>
                        <span className="text-sm font-extrabold text-navy-900">{plan.benchmarkComparison.nifty50Return}</span>
                      </div>
                      <div className={`p-3 rounded-xl text-center ${
                        plan.benchmarkComparison.alpha?.startsWith('+')
                          ? 'bg-emerald-50 border border-emerald-100'
                          : 'bg-red-50 border border-red-100'
                      }`}>
                        <span className="text-[10px] font-bold text-navy-900/40 uppercase tracking-wider">Alpha</span>
                        <p className={`text-lg font-extrabold ${
                          plan.benchmarkComparison.alpha?.startsWith('+') ? 'text-emerald-600' : 'text-red-600'
                        }`}>{plan.benchmarkComparison.alpha}</p>
                        <p className="text-[10px] text-navy-900/40 mt-0.5">{plan.benchmarkComparison.verdict}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ─ Rebalancing Recommendations ─ */}
              {plan.rebalancing?.length > 0 && (
                <motion.div {...anim(8)} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center"><ArrowRightLeft size={14} className="text-purple-500" /></div>
                    <h3 className="text-sm font-bold text-navy-900">AI Rebalancing Plan</h3>
                    {plan.annualSavings && (
                      <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        Save {plan.annualSavings}/yr
                      </span>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    {plan.rebalancing.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-extrabold ${
                          r.action === 'SELL' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-500 border border-emerald-100'
                        }`}>
                          {r.action === 'SELL' ? '−' : '+'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-navy-900">{r.fund}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[r.priority] || 'bg-gray-50 text-gray-500 border-gray-100'}`}>{r.priority}</span>
                          </div>
                          <p className="text-[10px] text-navy-900/40 mt-0.5">{r.reason}</p>
                        </div>
                        {r.amount && (
                          <span className={`text-xs font-extrabold flex-shrink-0 ${r.action === 'SELL' ? 'text-red-500' : 'text-emerald-500'}`}>
                            {r.action === 'SELL' ? '−' : '+'}{r.amount}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─ Summary ─ */}
              {plan.summary && (
                <motion.div {...anim(9)} className="glass-card p-4 text-center">
                  <p className="text-sm font-semibold text-navy-900/70">
                    <Sparkles size={14} className="inline -mt-0.5 mr-1 text-amber-500" />
                    {plan.summary}
                  </p>
                </motion.div>
              )}

              {/* Reset */}
              <div className="flex justify-center pt-1">
                <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-navy-900/15 text-navy-900/70 text-sm font-medium hover:border-navy-900/30 transition-colors">
                  Analyze Another Portfolio
                </button>
              </div>
              <p className="text-center text-navy-900/25 text-[10px]">* AI-generated analysis. Past returns don't guarantee future results.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
