import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'
import { useSystemStatus } from '../hooks/useSystemStatus'

const spring = (delay = 0) => ({ type: 'spring', stiffness: 90, damping: 18, delay })

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
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
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring(0.15)}
          >
            <img
              src="/9176010_6566.jpg"
              alt="Family financial planning illustration"
              className="w-full max-w-lg mx-auto"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
