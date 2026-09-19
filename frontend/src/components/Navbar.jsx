import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, UserRound } from 'lucide-react'
import StatusPill from './StatusPill'
import LanguageSwitcher from './LanguageSwitcher'
import BrandMark from './BrandMark'
import { useProfile } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'

const navLinks = [
  { key: 'nav.howItWorks', href: '#architecture' },
  { key: 'nav.fire', href: '#fire' },
  { key: 'nav.health', href: '#health' },
  { key: 'nav.tax', href: '#tax' },
  { key: 'nav.lifeEvents', href: '#advisor' },
  { key: 'nav.couples', href: '#couples' },
  { key: 'nav.xray', href: '#xray' },
  { key: 'nav.scam', href: '#scam' },
]

function ProfileButton({ full = false }) {
  const { hasProfile, profile, openDrawer } = useProfile()
  const { t } = useLanguage()
  if (!hasProfile) {
    return (
      <button onClick={() => openDrawer('profile')} className={`btn-ghost !px-3 !py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap ${full ? 'w-full justify-center' : ''}`}>
        <UserRound size={13} /> {t('nav.saveProfile')}
      </button>
    )
  }
  const initials = (profile.name || 'Me').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <button onClick={() => openDrawer('profile')} aria-label={t('nav.openProfile')} className={`flex items-center gap-2 ${full ? 'w-full justify-center py-2 rounded-xl border border-navy-900/10' : ''}`}>
      <span className="w-9 h-9 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center">{initials}</span>
      {full && <span className="text-sm font-semibold text-navy-900">{profile.name}</span>}
    </button>
  )
}

export default function Navbar() {
  const { t } = useLanguage()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20)
      let current = ''
      for (const l of navLinks) {
        const el = document.getElementById(l.href.slice(1))
        if (el && el.getBoundingClientRect().top <= 120) current = l.href.slice(1)
      }
      setActiveSection(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = useCallback((e, href) => {
    e.preventDefault()
    const el = document.getElementById(href.slice(1))
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
    setMenuOpen(false)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-cream/85 backdrop-blur-md border-b border-navy-900/[0.06] shadow-[0_8px_30px_-20px_rgba(10,25,47,0.35)]' : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-[72px]">
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="flex items-center gap-2.5 flex-shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/30"
          aria-label="FinMind home"
        >
          <BrandMark />
          <span className="text-[17px] font-extrabold tracking-tight text-navy-900">
            Fin<span className="text-navy-600/70">Mind</span>
          </span>
        </a>

        <div className="hidden xl:flex items-center justify-center flex-1 gap-0.5">
          {navLinks.map((l) => {
            const isActive = activeSection === l.href.slice(1)
            return (
              <a
                key={l.key}
                href={l.href}
                onClick={(e) => scrollTo(e, l.href)}
                className={`relative px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors duration-200 ${
                  isActive ? 'text-navy-900 bg-navy-900/[0.06]' : 'text-navy-900/50 hover:text-navy-900 hover:bg-navy-900/[0.03]'
                }`}
              >
                {t(l.key)}
                {isActive && (
                  <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-3 right-3 h-0.5 bg-navy-900 rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                )}
              </a>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <StatusPill />
            <LanguageSwitcher />
            <ProfileButton />
          </div>
          <button
            className="xl:hidden p-2 rounded-lg text-navy-900/70 hover:text-navy-900 hover:bg-navy-900/[0.05] transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="xl:hidden border-t border-navy-900/[0.06] bg-cream/95 backdrop-blur-md"
          >
            <div className="px-4 py-4 flex flex-col gap-1 max-w-7xl mx-auto">
              {navLinks.map((l) => {
                const isActive = activeSection === l.href.slice(1)
                return (
                  <a
                    key={l.key}
                    href={l.href}
                    onClick={(e) => scrollTo(e, l.href)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-navy-900 bg-navy-900/[0.06]' : 'text-navy-900/60 hover:text-navy-900 hover:bg-navy-900/[0.03]'}`}
                  >
                    {t(l.key)}
                  </a>
                )
              })}
              <div className="md:hidden mt-3 pt-3 border-t border-navy-900/[0.06] flex flex-col gap-3">
                <LanguageSwitcher inline />
                <StatusPill full />
                <ProfileButton full />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
