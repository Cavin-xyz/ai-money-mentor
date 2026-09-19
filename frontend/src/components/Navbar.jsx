import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Zap, UserRound } from 'lucide-react'
import StatusPill from './StatusPill'
import { useProfile } from '../context/ProfileContext'

const navLinks = [
  { label: 'How it works', href: '#architecture' },
  { label: 'FIRE', href: '#fire' },
  { label: 'Health', href: '#health' },
  { label: 'Tax', href: '#tax' },
  { label: 'Life Events', href: '#advisor' },
  { label: 'Couples', href: '#couples' },
  { label: 'X-Ray', href: '#xray' },
  { label: 'Scam Shield', href: '#scam' },
]

function ProfileButton({ full = false }) {
  const { hasProfile, profile, openDrawer } = useProfile()
  if (!hasProfile) {
    return (
      <button onClick={() => openDrawer('profile')} className={`btn-ghost !px-3 !py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap ${full ? 'w-full justify-center' : ''}`}>
        <UserRound size={13} /> Save profile
      </button>
    )
  }
  const initials = (profile.name || 'Me').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <button onClick={() => openDrawer('profile')} aria-label="Open your profile and memory" className={`flex items-center gap-2 ${full ? 'w-full justify-center py-2 rounded-xl border border-navy-900/10' : ''}`}>
      <span className="w-8 h-8 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center">{initials}</span>
      {full && <span className="text-sm font-semibold text-navy-900">{profile.name}</span>}
    </button>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20)

      // Determine active section based on scroll position
      const sections = navLinks.map(l => l.href.slice(1))
      let current = ''
      for (const id of sections) {
        const el = document.getElementById(id)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 120) current = id
        }
      }
      setActiveSection(current)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = useCallback((e, href) => {
    e.preventDefault()
    const id = href.slice(1)
    const el = document.getElementById(id)
    if (el) {
      const offset = 72 // navbar height + breathing room
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
    setMenuOpen(false)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-cream/90 backdrop-blur-md border-b border-navy-900/[0.06] shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <a
          href="#"
          onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="flex items-center gap-2.5 group flex-shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-navy-900/10 border border-navy-900/20 flex items-center justify-center group-hover:bg-navy-900/15 transition-colors">
            <Zap size={16} className="text-navy-900" />
          </div>
          <span className="font-bold text-navy-900 text-base tracking-tight hidden sm:inline">
            Money<span className="text-navy-600">Mentor</span>
          </span>
        </a>

        {/* Desktop Links (Centered) */}
        <div className="hidden lg:flex items-center justify-center flex-1 mx-4 gap-0.5">
          {navLinks.map(l => {
            const isActive = activeSection === l.href.slice(1)
            return (
              <a
                key={l.label}
                href={l.href}
                onClick={e => scrollTo(e, l.href)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-navy-900 bg-navy-900/[0.06]'
                    : 'text-navy-900/50 hover:text-navy-900 hover:bg-navy-900/[0.03]'
                }`}
              >
                {l.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 left-3 right-3 h-0.5 bg-navy-900 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </a>
            )
          })}
        </div>

        {/* Right: local stack status + memory */}
        <div className="hidden lg:flex items-center justify-end gap-2 w-[250px] flex-shrink-0">
          <StatusPill />
          <ProfileButton />
        </div>

        {/* Mobile menu toggle */}
        <button
          className="lg:hidden p-2 rounded-lg text-navy-900/70 hover:text-navy-900 hover:bg-navy-900/[0.05] transition-colors"
          onClick={() => setMenuOpen(v => !v)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-navy-900/[0.06] bg-cream/95 backdrop-blur-md"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map(l => {
                const isActive = activeSection === l.href.slice(1)
                return (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={e => scrollTo(e, l.href)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'text-navy-900 bg-navy-900/[0.06]'
                        : 'text-navy-900/60 hover:text-navy-900 hover:bg-navy-900/[0.03]'
                    }`}
                  >
                    {l.label}
                  </a>
                )
              })}
              <div className="mt-3 pt-3 border-t border-navy-900/[0.06] flex flex-col gap-2">
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
