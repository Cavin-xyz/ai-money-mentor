import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Monitor, Database, Calculator, BookOpen, Layers, Cpu, ShieldCheck, Lightbulb, CheckCircle2,
  Lock, BookOpenCheck, Sigma, Eye, ExternalLink, Network,
} from 'lucide-react'
import { getJson } from '../lib/api'
import { useSystemStatus } from '../hooks/useSystemStatus'

const WHY = [
  ['Personalized', 'Remembers you across sessions, in a file on this laptop'],
  ['Accurate', 'Every number comes from a deterministic calculation engine'],
  ['Grounded', 'Rules are retrieved from official SEBI, RBI and Income Tax sources'],
  ['Private', 'No cloud AI API — the model runs locally through Ollama'],
  ['Explainable', 'Shows the formula behind each number and cites its sources'],
  ['Reliable', 'Checks the AI\'s text against the calculator before you see it'],
]

const PRINCIPLES = [
  [Lock, 'Privacy first'],
  [BookOpenCheck, 'Grounded in real sources'],
  [Sigma, 'Deterministic calculations'],
  [Eye, 'Explainable AI'],
]

export default function ArchitectureSection() {
  const { status, backendDown } = useSystemStatus()
  const [sources, setSources] = useState(null)

  useEffect(() => {
    let alive = true
    getJson('/api/knowledge/sources').then((s) => { if (alive) setSources(s) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const chat = status?.ollama?.loaded?.find((m) => m.name.startsWith(status.ollama.chatModel))
  const steps = [
    { icon: Monitor, title: 'Your input', body: 'Forms, Form 16, CAS statements', live: 'Browser → local Spring Boot' },
    { icon: Database, title: 'Persistent memory', body: 'Profile, goals, history, preferences', live: status ? `SQLite · ${status.sqlite.profiles} profile(s)` : '…' },
    { icon: Calculator, title: 'Financial engine', body: 'Tax, FIRE, EMI, health score, portfolio', live: status ? `Rules TY ${status.rules.defaultTaxYear} · verified ${status.rules.verifiedOn}` : '…' },
    { icon: BookOpen, title: 'Knowledge RAG', body: 'Vector + keyword search, old→new section map', live: status ? `${status.knowledge.chunks.toLocaleString('en-IN')} passages · ${status.knowledge.documents} official docs` : '…' },
    { icon: Layers, title: 'Context builder', body: 'Memory + calculations + cited sources', live: 'Prompt assembled per request' },
    { icon: Cpu, title: 'Local LLM', body: 'Writes the explanation — never the numbers', live: status ? `${status.ollama.chatModel}${chat ? ` · ${chat.gpuPct}% GPU` : ''}` : '…' },
    { icon: ShieldCheck, title: 'Safety & trust', body: 'Numbers, sources, products, consistency', live: 'Retries once, else calculator text' },
  ]

  return (
    <section id="architecture" className="py-24 relative scroll-mt-20">
      <div className="absolute inset-0 grid-dot-bg opacity-20 pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="section-tag mx-auto mb-4"><Network size={11} /> How it works</div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-navy-900">
            From data to <span className="gradient-text">better decisions</span>
          </h2>
          <p className="mt-4 text-navy-900/50 max-w-2xl mx-auto">
            Every tool runs the same seven steps on this laptop. The numbers below are live from the running system.
          </p>
          {backendDown && <p className="mt-3 text-xs text-red-600">The local backend isn't reachable — start it to see live figures.</p>}
        </div>

        {/* Pipeline */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.06 }}
              className="glass-card p-5 relative"
            >
              <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-navy-900 text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
              <div className="w-10 h-10 rounded-xl bg-navy-900/[0.05] border border-navy-900/10 flex items-center justify-center mb-3">
                <s.icon size={18} className="text-navy-900/60" />
              </div>
              <p className="text-sm font-bold text-navy-900">{s.title}</p>
              <p className="text-xs text-navy-900/50 mt-0.5">{s.body}</p>
              <p className="mt-3 text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 inline-block">{s.live}</p>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.45 }}
            className="rounded-2xl p-5 bg-navy-900 text-white"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3"><Lightbulb size={18} /></div>
            <p className="text-sm font-bold">Explainable recommendation</p>
            <p className="text-xs text-white/60 mt-0.5">Numbers, formulas, cited sources and a trust report — in your language.</p>
          </motion.div>
        </div>

        <div className="mt-8 grid lg:grid-cols-3 gap-5">
          {/* Trusted sources */}
          <div className="lg:col-span-2 glass-card p-6">
            <p className="text-sm font-bold text-navy-900 mb-1">Trusted sources on this device</p>
            <p className="text-xs text-navy-900/45 mb-4">Official documents in the knowledge base, plus rule and market data files.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {(sources?.authorities || []).map((a) => (
                <div key={a.authority} className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-navy-900">{a.authority}</p>
                    <span className="text-[10px] text-navy-900/40">{a.documents.length} doc(s) · {a.chunks} passages</span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {a.documents.map((d) => (
                      <li key={d.title}>
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1">{d.title} <ExternalLink size={9} /></a>
                      </li>
                    ))}
                  </ul>
                  {a.verifiedOn && <p className="text-[10px] text-navy-900/35 mt-1">Verified {a.verifiedOn}</p>}
                </div>
              ))}
              <div className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                <p className="text-xs font-bold text-navy-900">AMFI · daily NAV data</p>
                <p className="text-[11px] text-navy-900/50 mt-1">{status ? `${status.amfi.schemes.toLocaleString('en-IN')} schemes · NAVs as of ${status.amfi.navDate}` : '…'}</p>
              </div>
              <div className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                <p className="text-xs font-bold text-navy-900">Tax rules (versioned JSON)</p>
                <p className="text-[11px] text-navy-900/50 mt-1">{status ? `${status.rules.taxYears.join(' & ')} · verified ${status.rules.verifiedOn}` : '…'}</p>
              </div>
            </div>
            {sources && !sources.authorities.length && <p className="text-xs text-navy-900/45 mt-2">No documents ingested yet.</p>}
          </div>

          {/* Why */}
          <div className="glass-card p-6">
            <p className="text-sm font-bold text-navy-900 mb-3">Why this architecture?</p>
            <ul className="space-y-2.5">
              {WHY.map(([k, v]) => (
                <li key={k} className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-navy-900/60"><strong className="text-navy-900">{k}</strong> — {v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PRINCIPLES.map(([Icon, label]) => (
            <div key={label} className="glass-card p-4 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-navy-900 text-white flex items-center justify-center"><Icon size={16} /></span>
              <span className="text-sm font-bold text-navy-900">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
