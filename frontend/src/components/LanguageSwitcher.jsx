import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Languages, Check, ChevronDown } from 'lucide-react'
import { LANGUAGES } from '../i18n/strings'
import { useLanguage } from '../context/LanguageContext'

/** Navbar language menu. `inline` renders a segmented list for the mobile menu instead of a dropdown. */
export default function LanguageSwitcher({ inline = false }) {
  const { lang, setLang, t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (inline) {
    return (
      <div>
        <p className="text-[11px] font-semibold text-navy-900/45 mb-2 flex items-center gap-1.5"><Languages size={12} /> {t('nav.language')}</p>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t('nav.language')}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={lang === l.code}
              onClick={() => setLang(l.code)}
              className={`py-2 rounded-xl border text-sm font-semibold transition-colors ${lang === l.code ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-900/10 bg-white text-navy-900/70'}`}
            >
              {l.native}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-navy-900/40 mt-1.5">{t('lang.note')}</p>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('nav.language')}: ${language.native}`}
        className="flex items-center gap-1.5 h-9 pl-2.5 pr-2 rounded-full border border-navy-900/10 bg-white/80 text-[12px] font-semibold text-navy-900/75 hover:border-navy-900/25 hover:text-navy-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/30"
      >
        <Languages size={14} className="text-navy-900/50" />
        <span>{language.native}</span>
        <ChevronDown size={12} className={`text-navy-900/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="absolute right-0 top-full mt-2 w-60 origin-top-right rounded-2xl bg-white p-1.5 shadow-[0_18px_50px_-18px_rgba(10,25,47,0.35)] ring-1 ring-navy-900/[0.07] z-50"
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                role="menuitemradio"
                aria-checked={lang === l.code}
                onClick={() => { setLang(l.code); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${lang === l.code ? 'bg-navy-900/[0.05]' : 'hover:bg-navy-900/[0.03]'}`}
              >
                <span>
                  <span className="block text-sm font-semibold text-navy-900">{l.native}</span>
                  {l.code !== 'en' && <span className="block text-[11px] text-navy-900/45">{l.english}</span>}
                </span>
                {lang === l.code && <Check size={15} className="text-emerald-600" />}
              </button>
            ))}
            <p className="px-3 pt-2 pb-1.5 text-[10.5px] leading-snug text-navy-900/45 border-t border-navy-900/[0.06] mt-1">{t('lang.note')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
