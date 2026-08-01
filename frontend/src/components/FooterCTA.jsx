import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { ArrowRight, Zap, FileCheck, HeartPulse, X } from 'lucide-react'
import PrivacyPolicy from './PrivacyPolicy'

export default function FooterCTA() {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPrivacyOpen(false)
      }
    }
    if (isPrivacyOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPrivacyOpen])

  return (
    <footer className="relative pt-24 pb-12 overflow-hidden">
      <div className="absolute inset-0 grid-dot-bg opacity-20 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main CTA block */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="bg-navy-900 rounded-2xl p-10 sm:p-16 text-center mb-20 relative overflow-hidden"
        >
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-br-full" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-tl-full" />



          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-5 text-white">
            Your Financial Independence
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/80 via-white to-white/60">Starts Today.</span>
          </h2>

          <p className="text-white/50 max-w-lg mx-auto text-lg leading-relaxed mb-10">
            Stop guessing and start growing with AI-powered financial
            guidance tailored to your goals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => {
                const el = document.getElementById('fire')
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 72
                  window.scrollTo({ top, behavior: 'smooth' })
                }
              }}
              className="px-8 py-4 rounded-xl bg-white text-navy-900 font-semibold text-base flex items-center gap-2 shadow-xl hover:bg-white/90 active:scale-95 transition-all"
            >
              Get My Free FIRE Plan <ArrowRight size={18} />
            </button>
          </div>

          <p className="mt-6 text-xs text-white/30">
            No jargon. No spam. Just clarity. ✦ Cancel anytime.
          </p>
        </motion.div>

        {/* Footer links row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-navy-900/[0.08] pt-8"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-navy-900/10 border border-navy-900/20 flex items-center justify-center">
              <Zap size={11} className="text-navy-900" />
            </div>
            <span className="font-bold text-sm text-navy-900">
              AI<span className="text-navy-600">Money</span>Mentor
            </span>
            <span className="text-navy-900/25 text-xs ml-2">by ET Markets</span>
          </div>

          <div className="flex flex-wrap gap-6 justify-center">
            {['Privacy Policy', 'Terms of Service', 'SEBI Disclosure', 'Contact', 'Blog'].map(link => (
              <a
                key={link}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (link === 'Privacy Policy') {
                    setIsPrivacyOpen(true)
                  }
                }}
                className="text-xs text-navy-900/35 hover:text-navy-900/60 transition-colors cursor-pointer"
              >
                {link}
              </a>
            ))}
          </div>

          <p className="text-xs text-navy-900/30">© 2026 ET Money Mentor</p>
        </motion.div>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-[11px] text-navy-900/25 leading-relaxed max-w-3xl mx-auto">
          Disclaimer: AI Money Mentor provides educational financial information and should not be construed as
          personalised financial advice. All investments are subject to market risk. Please consult a SEBI-registered
          investment advisor before making investment decisions.
        </p>
      </div>

      {/* Privacy Policy Modal Portaled to Document Body */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isPrivacyOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-navy-950/75 backdrop-blur-md overflow-y-auto"
              onClick={() => setIsPrivacyOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-y-auto border border-navy-900/10 p-6 sm:p-10 my-auto text-navy-900 z-[100000]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setIsPrivacyOpen(false)}
                  className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 rounded-full text-navy-900/50 hover:text-navy-900 hover:bg-navy-900/10 transition-all z-20"
                  aria-label="Close Privacy Policy"
                >
                  <X size={22} />
                </button>

                <PrivacyPolicy />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </footer>
  )
}
