import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ScanLine, Calculator, Users, LayoutGrid, ArrowRight, Flame, Lightbulb, Activity, ShieldAlert } from 'lucide-react'

const scrollTo = (href) => {
  const el = document.getElementById(href.slice(1))
  if (el) {
    const offset = 72
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }
}

const features = [
  {
    icon: ScanLine,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-200',
    tag: 'Portfolio X-Ray',
    title: 'Instant Portfolio Audit',
    desc: 'Upload your CAMS/KFintech statement — parsed on your laptop, matched to AMFI data. See overlap, real XIRR and what Regular plans cost you.',
    href: '#xray',
  },
  {
    icon: Calculator,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
    tag: 'Tax Wizard',
    title: 'Old vs. New Regime',
    desc: 'Old vs New regime calculated to the rupee for Tax Year 2026-27, with answers cited from Income Tax Department sources.',
    href: '#tax',
  },
  {
    icon: Users,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50 border-purple-200',
    tag: "Couple's Planner",
    title: 'Optimize Together',
    desc: 'Both partners run through the tax engine; every suggested move is priced by recomputing the tax, plus fair ways to split costs.',
    href: '#couples',
  },
]

const miniFeatures = [
  { icon: Flame, title: 'FIRE Path Planner', desc: 'Required SIP, glide path and 1,000 market scenarios, with instant what-ifs.', href: '#fire' },
  { icon: Lightbulb, title: 'Life Event Advisor', desc: 'Bonus, baby, home or new job: tax, EMIs and health-score impact.', href: '#advisor' },
  { icon: Activity, title: 'Money Health Score', desc: 'Six dimensions scored by visible formulas, not AI guesses.', href: '#health' },
  { icon: ShieldAlert, title: 'Scam Shield', desc: 'Check a message, UPI ID or loan app against SEBI and RBI rules.', href: '#scam' },
]

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: i => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.12, ease: 'easeOut' },
  }),
}

export default function FeatureBentoGrid() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="features" className="py-24 relative">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="section-tag mx-auto mb-4">
            <LayoutGrid size={11} />
            Core Features
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-navy-900">
            Everything You Need to <span className="gradient-text">Grow Wealth</span>
          </h2>
          <p className="mt-4 text-navy-900/50 max-w-lg mx-auto">
            Seven tools. Each one calculates with a deterministic engine, cites official sources and explains with an AI that never leaves your laptop.
          </p>
        </motion.div>

        {/* Main feature cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.tag}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              className="glass-card-hover p-6 cursor-pointer group"
              onClick={() => scrollTo(f.href)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-9 rounded-xl ${f.iconBg} border flex items-center justify-center`}>
                  <f.icon size={17} className={f.iconColor} />
                </div>
                <div>
                  <p className={`text-xs font-semibold ${f.iconColor} uppercase tracking-wider`}>{f.tag}</p>
                  <h3 className="text-base font-bold text-navy-900">{f.title}</h3>
                </div>
              </div>
              <p className="text-sm text-navy-900/50 leading-relaxed">{f.desc}</p>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-navy-900/40 group-hover:text-navy-900 transition-colors">
                Explore feature <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mini feature cards */}
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {miniFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i + 3}
              variants={cardVariants}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              className="glass-card-hover p-5 flex items-start gap-4 cursor-pointer"
              onClick={() => scrollTo(f.href)}
            >
              <div className="w-10 h-10 rounded-xl bg-navy-900/[0.05] border border-navy-900/10 flex items-center justify-center flex-shrink-0">
                <f.icon size={18} className="text-navy-900/50" />
              </div>
              <div>
                <p className="text-sm font-bold text-navy-900">{f.title}</p>
                <p className="text-xs text-navy-900/45 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
