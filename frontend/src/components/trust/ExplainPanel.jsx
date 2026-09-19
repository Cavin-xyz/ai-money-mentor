import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calculator, ChevronDown, ExternalLink } from 'lucide-react'

/** "How we calculated this" — every number on screen traced to a formula, an input or a sourced rule. */
export default function ExplainPanel({ calculations = [], assumptions = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const groups = useMemo(() => {
    const m = new Map()
    for (const c of calculations) {
      if (!m.has(c.group)) m.set(c.group, [])
      m.get(c.group).push(c)
    }
    return [...m.entries()]
  }, [calculations])

  if (!calculations.length) return null

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-navy-900/[0.02] transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-navy-900/[0.05] border border-navy-900/10 flex items-center justify-center">
            <Calculator size={14} className="text-navy-900/60" />
          </span>
          <span>
            <span className="block text-sm font-bold text-navy-900">How we calculated this</span>
            <span className="block text-[11px] text-navy-900/45">{calculations.length} steps from the deterministic engine — no AI arithmetic</span>
          </span>
        </span>
        <ChevronDown size={16} className={`text-navy-900/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-navy-900/[0.06]"
          >
            <div className="px-5 py-4 space-y-5 max-h-[28rem] overflow-y-auto">
              {assumptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assumptions.map((a) => (
                    <span key={a} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-800">{a}</span>
                  ))}
                </div>
              )}
              {groups.map(([group, rows]) => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40 mb-2">{group}</p>
                  <table className="w-full text-xs">
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b border-navy-900/[0.04] last:border-0 align-top">
                          <td className="py-1.5 pr-3 text-navy-900/75 w-[38%]">{r.label}</td>
                          <td className="py-1.5 pr-3 font-mono text-[11px] text-navy-900/45 break-words">
                            {r.formula === 'rule' && r.source ? (
                              <a href={r.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline font-sans">
                                Official rule <ExternalLink size={10} />
                              </a>
                            ) : r.formula === 'rule' ? 'rule' : r.formula}
                          </td>
                          <td className="py-1.5 text-right font-mono font-semibold text-navy-900 whitespace-nowrap">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
