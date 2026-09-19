import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Calculator, Languages, ShieldCheck } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'
import { useSystemStatus } from '../hooks/useSystemStatus'

const spring = (delay = 0) => ({ type: 'spring', stiffness: 90, damping: 18, delay })

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
}

/** A slice of the real product — the engine's own output for an ₹18L salary — instead of stock art. */
function HeroPreview() {
  const { t, language } = useLanguage()
  const rows = [
    { key: 'old', label: t('preview.old'), note: t('preview.oldNote'), value: '₹2,96,400', share: 1, bar: 'bg-navy-900/15', text: 'text-navy-900/70' },
    { key: 'new', label: t('preview.new'), note: 'Sec 202', value: '₹1,50,800', share: 0.509, bar: 'bg-emerald-500', text: 'text-emerald-700' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring(0.15)}
      className="relative mx-auto w-full max-w-[31rem] lg:ml-auto lg:mr-0"
      aria-label="Example: FinMind comparing old and new tax regimes for an ₹18 lakh salary"
    >
      <div className="relative rounded-[1.75rem] bg-white p-6 sm:p-7 sm:pb-24 ring-1 ring-navy-900/[0.06] shadow-[0_45px_90px_-45px_rgba(10,25,47,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-navy-900/45">{t('preview.title')} · TY 2026-27</p>
            <p className="mt-1 text-sm font-semibold text-navy-900">
              {t('preview.gross')} <span className="font-mono tabular-nums">₹18,00,000</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <ShieldCheck size={12} /> {t('preview.checks')}
          </span>
        </div>

        <div className="mt-7 space-y-5">
          {rows.map((r, i) => (
            <div key={r.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-navy-900">
                  {r.label} <span className="ml-1 text-[11px] font-medium text-navy-900/40">{r.note}</span>
                </p>
                <p className={`font-mono text-base font-bold tabular-nums ${r.text}`}>{r.value}</p>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-navy-900/[0.05] overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${r.bar}`}
                  style={{ width: `${r.share * 100}%`, originX: 0 }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.45 + i * 0.15 }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-xl bg-emerald-50/80 px-4 py-3 text-sm font-semibold text-emerald-800">
          {t('preview.save', { amount: '₹1,45,600' })}
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100">
          <span className="font-bold">S1</span> Income Tax Dept · Sec 202 (formerly 115BAC)
        </p>
      </div>

      {/* Floating: the working behind the new-regime number */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring(0.55)}
        className="absolute -bottom-24 -left-8 hidden w-[15.5rem] rounded-2xl bg-navy-900 p-4 text-white shadow-[0_28px_60px_-28px_rgba(10,25,47,0.8)] sm:block"
      >
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-white/55"><Calculator size={12} /> {t('preview.how')}</p>
        <dl className="mt-3 space-y-1.5 font-mono text-[12px] tabular-nums">
          {[
            [t('preview.taxable'), '17,25,000'],
            [t('preview.slabs'), '1,45,000'],
            [t('preview.cess'), '5,800'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="font-sans text-white/60 truncate">{k}</dt><dd>{v}</dd></div>
          ))}
          <div className="flex justify-between gap-3 border-t border-white/10 pt-1.5 font-semibold"><dt className="font-sans">{t('preview.total')}</dt><dd>1,50,800</dd></div>
        </dl>
      </motion.div>

      {/* Floating: explanations follow the chosen language */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring(0.75)}
        className="absolute -top-5 right-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 ring-1 ring-navy-900/[0.07] shadow-[0_14px_30px_-16px_rgba(10,25,47,0.45)]"
      >
        <Languages size={13} className="text-navy-900/50" /> {t('preview.explained', { lang: language.native })}
      </motion.div>
    </motion.div>
  )
}

export default function HeroSection() {
  const { hasProfile, profile } = useProfile()
  const { t, isLatin } = useLanguage()
  const { status } = useSystemStatus()
  const passages = status?.knowledge?.chunks

  const stats = [
    ['7', t('hero.stat.tools')],
    [passages ? passages.toLocaleString('en-IN') : '100+', t('hero.stat.passages')],
    ['4', t('hero.stat.languages')],
  ]

  return (
    <section className="relative overflow-hidden pt-28 pb-24 sm:pt-32 lg:flex lg:min-h-[92dvh] lg:items-center lg:pb-28">
      {/* Ambient layers: masked dot grid, two soft light pools, film grain */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 grid-dot-bg opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_20%_30%,black,transparent)]" />
        <div className="absolute -right-48 top-8 h-[36rem] w-[36rem] rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute right-[28%] top-[55%] h-72 w-72 rounded-full bg-navy-600/[0.07] blur-3xl" />
        <div className="grain absolute inset-0 opacity-60" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:px-8">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring(0)}
            className="inline-flex items-center gap-2.5 text-[13px] font-medium text-navy-900/55"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {hasProfile ? t('hero.welcome', { name: profile.name }) : t('hero.eyebrow')}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring(0.06)}
            className={`mt-6 text-[2.6rem] font-extrabold text-navy-900 sm:text-6xl lg:text-[4.35rem] [text-wrap:balance] ${isLatin ? 'leading-[1.02] tracking-[-0.035em]' : 'leading-[1.22]'}`}
          >
            <span className="block">{t('hero.title1')}</span>
            <span className="block text-navy-900/35 [text-wrap:balance]">{t('hero.title2')}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring(0.12)}
            className={`mt-7 max-w-[34rem] text-[17px] text-navy-900/60 [text-wrap:pretty] ${isLatin ? 'leading-relaxed' : 'leading-loose'}`}
          >
            <span className="font-semibold text-navy-900/85">{t('hero.lead')}</span> {t('hero.sub')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring(0.18)}
            className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4"
          >
            <button
              onClick={() => scrollToId('fire')}
              className="group inline-flex items-center gap-2 rounded-xl bg-navy-900 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_rgba(10,25,47,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-navy-800 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              {t('hero.cta')}
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
            <a
              href="#architecture"
              onClick={(e) => { e.preventDefault(); scrollToId('architecture') }}
              className="group inline-flex items-center gap-1 text-sm font-semibold text-navy-900/65 transition-colors hover:text-navy-900"
            >
              <span className="border-b border-navy-900/20 pb-0.5 transition-colors group-hover:border-navy-900/60">{t('hero.secondary')}</span>
              <ArrowUpRight size={14} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-14 grid max-w-lg grid-cols-3 divide-x divide-navy-900/10 border-t border-navy-900/10 pt-6"
          >
            {stats.map(([value, label]) => (
              <div key={label} className="flex flex-col-reverse gap-1 px-4 first:pl-0">
                <dt className="text-[12px] leading-snug text-navy-900/50">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums tracking-tight text-navy-900">{value}</dd>
              </div>
            ))}
          </motion.dl>
          <p className="mt-5 text-xs text-navy-900/40">{t('hero.footnote')}</p>
        </div>

        <div className="pb-6 sm:pb-28">
          <HeroPreview />
        </div>
      </div>
    </section>
  )
}
