import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, ExternalLink, X } from 'lucide-react'
import { sectionLabel } from '../../lib/format'

const AUTHORITY_STYLE = {
  'Income Tax Department': 'bg-amber-50 text-amber-800 border-amber-200',
  SEBI: 'bg-blue-50 text-blue-800 border-blue-200',
  RBI: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  AMFI: 'bg-violet-50 text-violet-800 border-violet-200',
}

/** Citation chips; each opens the retrieved passage and a link to the official page. */
export default function SourceChips({ citations = [], compact = false }) {
  const [openId, setOpenId] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!openId) return undefined
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenId(null) }
    const onKey = (e) => { if (e.key === 'Escape') setOpenId(null) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [openId])

  if (!citations.length) {
    return compact ? null : (
      <p className="text-[11px] text-navy-900/40 flex items-center gap-1.5">
        <BookOpen size={12} /> No matching passages in the official documents on this device.
      </p>
    )
  }
  const open = citations.find((c) => c.id === openId)

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {!compact && <span className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40 mr-1">Sources</span>}
        {citations.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpenId(openId === c.id ? null : c.id)}
            aria-expanded={openId === c.id}
            className={`inline-flex items-center gap-1.5 max-w-full text-[11px] px-2.5 py-1 rounded-full border transition-shadow hover:shadow-sm ${AUTHORITY_STYLE[c.authority] || 'bg-navy-900/[0.04] text-navy-900/70 border-navy-900/10'}`}
          >
            <span className="font-bold">{c.id}</span>
            <span className="truncate">{c.authority}{sectionLabel(c) ? ` · ${sectionLabel(c)}` : ''}</span>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-30 left-0 right-0 sm:right-auto sm:w-[28rem] mt-2 bg-white border border-navy-900/10 rounded-xl shadow-xl p-4"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40">{open.id} · {open.authority}</p>
                <p className="text-sm font-bold text-navy-900 leading-snug">{open.title}</p>
                {sectionLabel(open) && <p className="text-[11px] text-amber-700 font-semibold mt-0.5">{sectionLabel(open)}{open.taxYear && open.taxYear !== 'all' ? ` · TY ${open.taxYear}` : ''}</p>}
              </div>
              <button onClick={() => setOpenId(null)} className="p-1 rounded-lg text-navy-900/40 hover:bg-navy-900/[0.05]" aria-label="Close"><X size={14} /></button>
            </div>
            <p className="text-xs text-navy-900/65 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-line">{open.snippet}</p>
            {open.url && (
              <a href={open.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline">
                Open official source <ExternalLink size={12} />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
