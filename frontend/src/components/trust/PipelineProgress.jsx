import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserRound, Calculator, BookOpen, Cpu, ShieldCheck, Check, Loader2, ChevronDown, FileSearch } from 'lucide-react'

const BASE_STEPS = [
  { key: 'memory', label: 'Reading your profile', icon: UserRound },
  { key: 'calc', label: 'Calculating (Java engine)', icon: Calculator },
  { key: 'retrieve', label: 'Searching SEBI · RBI · Income Tax sources', icon: BookOpen },
  { key: 'llm', label: 'Writing explanation (local model)', icon: Cpu },
  { key: 'safety', label: 'Safety checks', icon: ShieldCheck },
]

const PARSE_STEP = { key: 'parse', label: 'Parsing statement · matching AMFI schemes', icon: FileSearch }

function fmtMs(ms) {
  if (ms === undefined || ms === null) return ''
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`
}

/**
 * Live view of the backend pipeline (the architecture diagram's workflow steps).
 * Collapses to a one-line summary once the result is in.
 */
export default function PipelineProgress({ stages = {}, status, withParse = false, citations = [], trust }) {
  const [expanded, setExpanded] = useState(false)
  const steps = withParse ? [PARSE_STEP, ...BASE_STEPS] : BASE_STEPS
  const done = status === 'done'
  const totalMs = Object.values(stages).filter((s) => s.status === 'done').reduce((a, s) => a + (s.ms || 0), 0)
  const passed = trust?.checks?.filter((c) => c.passed).length
  const total = trust?.checks?.length

  const rowState = (key) => {
    if (key === 'parse') return Object.keys(stages).length ? 'done' : status === 'running' ? 'start' : 'pending'
    return stages[key]?.status || 'pending'
  }

  if (done && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-left hover:bg-emerald-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <Check size={14} className="text-emerald-600" />
          Done in {fmtMs(totalMs)} · {citations.length} source{citations.length === 1 ? '' : 's'}
          {total ? ` · ${passed}/${total} checks passed` : ''}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-emerald-700/70">How it ran <ChevronDown size={12} /></span>
      </button>
    )
  }

  return (
    <div className="glass-card p-4 sm:p-5" aria-live="polite">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40">Running on this laptop</p>
        {done && (
          <button onClick={() => setExpanded(false)} className="text-[11px] text-navy-900/40 hover:text-navy-900">Hide</button>
        )}
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const st = rowState(s.key)
          const info = stages[s.key]
          const Icon = s.icon
          return (
            <motion.li
              key={s.key}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3"
            >
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors ${
                st === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : st === 'start' || st === 'retry' ? 'bg-navy-900 border-navy-900 text-white'
                  : 'bg-navy-900/[0.03] border-navy-900/10 text-navy-900/25'
              }`}>
                {st === 'done' ? <Check size={13} /> : st === 'start' || st === 'retry' ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
              </span>
              <span className={`flex-1 min-w-0 text-sm ${st === 'pending' ? 'text-navy-900/35' : 'text-navy-900 font-medium'}`}>
                {s.label}
                <AnimatePresence>
                  {info?.detail && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`block text-[11px] truncate ${st === 'retry' ? 'text-amber-600' : 'text-navy-900/45'}`}>
                      {info.detail}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="text-[11px] font-mono text-navy-900/35 tabular-nums">{st === 'done' ? fmtMs(info?.ms) : ''}</span>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}
