import { motion } from 'framer-motion'
import { ArrowRight, Cpu, Lock, Calculator, BookOpenCheck } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'

export default function HeroSection() {
  const { hasProfile, profile } = useProfile()
  const scrollToFire = (e) => {
    e.preventDefault()
    const el = document.getElementById('fire')
    if (el) {
      const offset = 72
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-24 pb-16 overflow-hidden">
      <div className="absolute inset-0 grid-dot-bg opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

          {/* LEFT: Copy */}
          <div className="space-y-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="section-tag mb-5">
                <Cpu size={11} />
                Runs 100% on your device
              </div>
              {hasProfile && <p className="text-sm font-semibold text-navy-900/60 mb-2">Welcome back, {profile.name}.</p>}
              <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.1] tracking-tight text-navy-900">
                Stop Guessing.
                <br />
                <span className="gradient-text">Start Growing.</span>
              </h1>
              <p className="mt-5 text-lg text-navy-900/55 leading-relaxed max-w-lg">
                Every number calculated. Every rule cited. <span className="text-navy-900 font-semibold">Nothing leaves this laptop.</span>
                A private money mentor for India, grounded in SEBI, RBI and Income Tax sources.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <button
                onClick={scrollToFire}
                className="btn-primary flex items-center gap-2 px-6 py-3 text-sm"
              >
                Get My FIRE Plan <ArrowRight size={15} />
              </button>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  [Lock, 'Private — no cloud AI'],
                  [Calculator, 'Calculated, not guessed'],
                  [BookOpenCheck, 'Cited from SEBI · RBI · IT Dept'],
                ].map(([Icon, label]) => (
                  <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-navy-900/10 text-xs font-medium text-navy-900/65">
                    <Icon size={12} className="text-emerald-600" /> {label}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT: Illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center justify-center"
          >
            <img
              src="/9176010_6566.jpg"
              alt="Family financial planning illustration"
              className="w-full max-w-lg lg:max-w-xl object-contain"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
