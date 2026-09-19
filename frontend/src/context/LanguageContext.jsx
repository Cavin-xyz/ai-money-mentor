import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, STRINGS } from '../i18n/strings'
import { translatePhrase } from '../i18n/phrases'
import { getLanguage, setLanguage } from '../lib/api'
import { useProfile } from './ProfileContext'

const LanguageContext = createContext(null)
const CODES = new Set(LANGUAGES.map((l) => l.code))

function fill(s, vars) {
  if (!vars) return s
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v ?? '')
  return s
}

/**
 * One language choice drives the UI strings and the language of every AI explanation.
 * An explicit choice (stored on this device) wins; otherwise the saved profile's preference.
 */
export function LanguageProvider({ children }) {
  const { prefs, hasProfile, updatePrefs } = useProfile()
  const [choice, setChoice] = useState(getLanguage)
  const lang = choice || (CODES.has(prefs?.language) ? prefs.language : 'en')

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((code) => {
    if (!CODES.has(code)) return
    setChoice(code)
    setLanguage(code)
    if (hasProfile) updatePrefs({ language: code }).catch(() => {})
  }, [hasProfile, updatePrefs])

  const t = useCallback((key, vars) => fill(STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key, vars), [lang])

  /** Translates fixed text the backend sends (labels, priorities, check results); unknown text passes through. */
  const p = useCallback((text) => translatePhrase(text, lang), [lang])

  const value = useMemo(() => ({
    lang,
    setLang,
    t,
    p,
    language: LANGUAGES.find((l) => l.code === lang),
    isLatin: lang === 'en',
  }), [lang, setLang, t, p])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext)
}
