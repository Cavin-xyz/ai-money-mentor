import { useState } from 'react'
import { useSystemStatus } from '../hooks/useSystemStatus'
import { useLanguage } from '../context/LanguageContext'

const DOT = { ready: 'bg-emerald-500', loading: 'bg-amber-500 animate-pulse', offline: 'bg-red-500', down: 'bg-red-500' }

/** Live health of the local stack (Ollama, Qdrant, SQLite, knowledge base). */
export default function StatusPill({ full = false }) {
  const { status, backendDown } = useSystemStatus()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const state = backendDown ? 'down' : status?.state || 'loading'
  const chat = status?.ollama?.loaded?.find((m) => m.name.startsWith(status?.ollama?.chatModel || '~'))

  const rows = status ? [
    [t('status.row.llm'), status.ollama.up ? `${status.ollama.chatModel}${chat ? ` · ${chat.gpuPct}% GPU` : ` · ${t('status.notLoaded')}`}` : t('status.ollamaDown'), status.ollama.up && status.ollama.chatInstalled],
    [t('status.row.emb'), `${status.ollama.embeddingModel} · CPU`, status.ollama.embeddingInstalled],
    [t('status.row.vector'), status.qdrant.up ? t('status.vectors', { n: status.qdrant.vectors.toLocaleString('en-IN') }) : t('status.qdrantDown'), status.qdrant.up],
    [t('status.row.memory'), status.sqlite.up ? t('status.profiles', { n: status.sqlite.profiles }) : t('status.sqliteError'), status.sqlite.up],
    [t('status.row.knowledge'), t('status.docs', { docs: status.knowledge.documents, chunks: status.knowledge.chunks }), status.knowledge.chunks > 0],
    [t('status.row.rules'), t('status.rulesValue', { year: status.rules.defaultTaxYear, date: status.rules.verifiedOn }), true],
  ] : []

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={t(`status.${state}`)}
        className={`flex items-center gap-2 h-9 px-3 rounded-full border border-navy-900/10 bg-white/80 text-[11px] font-semibold text-navy-900/70 whitespace-nowrap ${full ? 'w-full justify-center' : ''}`}
      >
        <span className={`w-2 h-2 rounded-full ${DOT[state]}`} />
        {t(`status.${state}`)}
      </button>
      {open && rows.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-navy-900/10 rounded-xl shadow-xl p-3 z-50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40 mb-2">{t('status.local')}</p>
          {rows.map(([k, v, ok]) => (
            <div key={k} className="flex items-start justify-between gap-3 py-1 text-[11px]">
              <span className="text-navy-900/50">{k}</span>
              <span className={`text-right font-medium ${ok ? 'text-navy-900' : 'text-red-600'}`}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
