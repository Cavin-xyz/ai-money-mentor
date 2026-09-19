import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Monitor, Database, Calculator, BookOpen, Layers, Cpu, ShieldCheck, Lightbulb, CheckCircle2,
  Lock, BookOpenCheck, Sigma, Eye, ExternalLink, Network,
} from 'lucide-react'
import { getJson } from '../lib/api'
import { useSystemStatus } from '../hooks/useSystemStatus'
import { useLanguage } from '../context/LanguageContext'

// Copy: arch.why.<n>k / arch.why.<n>v and arch.p<n>
const WHY = [1, 2, 3, 4, 5, 6]

const PRINCIPLES = [
  [Lock, 'arch.p1'],
  [BookOpenCheck, 'arch.p2'],
  [Sigma, 'arch.p3'],
  [Eye, 'arch.p4'],
]

export default function ArchitectureSection() {
  const { status, backendDown } = useSystemStatus()
  const { t, p } = useLanguage()
  const [sources, setSources] = useState(null)

  useEffect(() => {
    let alive = true
    getJson('/api/knowledge/sources').then((s) => { if (alive) setSources(s) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const chat = status?.ollama?.loaded?.find((m) => m.name.startsWith(status.ollama.chatModel))
  const steps = [
    { n: 1, icon: Monitor, live: t('arch.s1.live') },
    { n: 2, icon: Database, live: status ? t('arch.s2.live', { n: status.sqlite.profiles }) : '…' },
    { n: 3, icon: Calculator, live: status ? t('arch.s3.live', { year: status.rules.defaultTaxYear, date: status.rules.verifiedOn }) : '…' },
    { n: 4, icon: BookOpen, live: status ? t('arch.s4.live', { passages: status.knowledge.chunks.toLocaleString('en-IN'), docs: status.knowledge.documents }) : '…' },
    { n: 5, icon: Layers, live: t('arch.s5.live') },
    { n: 6, icon: Cpu, live: status ? `${status.ollama.chatModel}${chat ? ` · ${chat.gpuPct}% GPU` : ''}` : '…' },
    { n: 7, icon: ShieldCheck, live: t('arch.s7.live') },
  ]

  return (
    <section id="architecture" className="py-24 relative scroll-mt-20">
      <div className="absolute inset-0 grid-dot-bg opacity-20 pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="section-tag mx-auto mb-4"><Network size={11} /> {t('arch.tag')}</div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-navy-900">
            {t('arch.title')} <span className="gradient-text">{t('arch.titleAccent')}</span>
          </h2>
          <p className="mt-4 text-navy-900/50 max-w-2xl mx-auto">
            {t('arch.sub')}
          </p>
          {backendDown && <p className="mt-3 text-xs text-red-600">{t('arch.backendDown')}</p>}
        </div>

        {/* Pipeline */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
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
              <p className="text-sm font-bold text-navy-900">{t(`arch.s${s.n}.title`)}</p>
              <p className="text-xs text-navy-900/50 mt-0.5">{t(`arch.s${s.n}.body`)}</p>
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
            <p className="text-sm font-bold">{t('arch.explainable.title')}</p>
            <p className="text-xs text-white/60 mt-0.5">{t('arch.explainable.body')}</p>
          </motion.div>
        </div>

        <div className="mt-8 grid lg:grid-cols-3 gap-5">
          {/* Trusted sources */}
          <div className="lg:col-span-2 glass-card p-6">
            <p className="text-sm font-bold text-navy-900 mb-1">{t('arch.sources.title')}</p>
            <p className="text-xs text-navy-900/45 mb-4">{t('arch.sources.sub')}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {(sources?.authorities || []).map((a) => (
                <div key={a.authority} className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-navy-900">{p(a.authority)}</p>
                    <span className="text-[10px] text-navy-900/40">{t('arch.sources.count', { docs: a.documents.length, chunks: a.chunks })}</span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {a.documents.map((d) => (
                      <li key={d.title}>
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1">{d.title} <ExternalLink size={9} /></a>
                      </li>
                    ))}
                  </ul>
                  {a.verifiedOn && <p className="text-[10px] text-navy-900/35 mt-1">{t('arch.sources.verified', { date: a.verifiedOn })}</p>}
                </div>
              ))}
              <div className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                <p className="text-xs font-bold text-navy-900">{t('arch.amfi.title')}</p>
                <p className="text-[11px] text-navy-900/50 mt-1">{status ? t('arch.amfi.body', { n: status.amfi.schemes.toLocaleString('en-IN'), date: status.amfi.navDate }) : '…'}</p>
              </div>
              <div className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                <p className="text-xs font-bold text-navy-900">{t('arch.rules.title')}</p>
                <p className="text-[11px] text-navy-900/50 mt-1">{status ? t('arch.rules.body', { years: status.rules.taxYears.join(' & '), date: status.rules.verifiedOn }) : '…'}</p>
              </div>
            </div>
            {sources && !sources.authorities.length && <p className="text-xs text-navy-900/45 mt-2">{t('arch.noDocs')}</p>}
          </div>

          {/* Why */}
          <div className="glass-card p-6">
            <p className="text-sm font-bold text-navy-900 mb-3">{t('arch.why.title')}</p>
            <ul className="space-y-2.5">
              {WHY.map((n) => (
                <li key={n} className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-navy-900/60"><strong className="text-navy-900">{t(`arch.why.${n}k`)}</strong> — {t(`arch.why.${n}v`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PRINCIPLES.map(([Icon, label]) => (
            <div key={label} className="glass-card p-4 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-navy-900 text-white flex items-center justify-center"><Icon size={16} /></span>
              <span className="text-sm font-bold text-navy-900">{t(label)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
