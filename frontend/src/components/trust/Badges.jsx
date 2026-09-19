import { useState } from 'react'
import { ShieldCheck, ShieldAlert, Cpu, Check, AlertTriangle, ChevronDown, Info } from 'lucide-react'

/** Result of the backend Safety & Trust layer: which checks passed and how grounded the answer is. */
export function TrustBadge({ trust, compact = false }) {
  const [open, setOpen] = useState(false)
  if (!trust) return null
  const allPassed = trust.checks.every((c) => c.passed)
  const template = trust.explanationSource === 'template' || trust.explanationSource === 'unavailable'
  const tone = template ? 'slate' : allPassed ? 'green' : 'amber'
  const styles = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    slate: 'bg-navy-900/[0.04] border-navy-900/15 text-navy-900/70',
  }[tone]
  const Icon = allPassed ? ShieldCheck : ShieldAlert

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${styles}`}
      >
        <Icon size={13} />
        {template ? 'Explanation from calculator templates' : allPassed ? 'All safety checks passed' : 'Checked with warnings'}
        {!compact && <span className="font-mono opacity-70">· {trust.groundedScore}% grounded</span>}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 left-0 w-[min(22rem,calc(100vw-2rem))] bg-white border border-navy-900/10 rounded-xl shadow-xl p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40">Safety & trust layer</p>
          {trust.checks.map((c) => (
            <div key={c.key} className="flex items-start gap-2">
              {c.passed ? <Check size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" /> : <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />}
              <div>
                <p className="text-xs font-semibold text-navy-900">{c.label}</p>
                <p className="text-[11px] text-navy-900/50 leading-snug">{c.detail}</p>
              </div>
            </div>
          ))}
          {trust.warnings?.length > 0 && (
            <div className="pt-2 border-t border-navy-900/[0.06] space-y-1">
              {trust.warnings.map((w) => <p key={w} className="text-[11px] text-amber-700">{w}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ModelBadge({ model, latencyMs }) {
  if (!model) return null
  const name = model.replace('qwen3.5:', 'Qwen3.5 ').replace('b', 'B')
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-navy-900/10 bg-white text-[11px] font-medium text-navy-900/60">
      <Cpu size={12} /> {name} · on-device{latencyMs ? ` · ${(latencyMs / 1000).toFixed(1)} s` : ''}
    </span>
  )
}

export function Disclaimer({ text }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-navy-900/40 leading-relaxed">
      <Info size={12} className="mt-0.5 flex-shrink-0" />
      {text || 'Educational guidance generated on this device, not investment, tax or legal advice. Numbers come from a deterministic calculator; verify important decisions with a SEBI-registered adviser or a Chartered Accountant.'}
    </p>
  )
}
