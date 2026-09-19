import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, STRINGS } from '../i18n/strings'
import { getLanguage, setLanguage } from '../lib/api'
import { useProfile } from './ProfileContext'

const LanguageContext = createContext(null)
const CODES = new Set(LANGUAGES.map((l) => l.code))

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

  const t = useCallback((key, vars) => {
    let s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v)
    return s
  }, [lang])

  const value = useMemo(() => ({
    lang,
    setLang,
    t,
    language: LANGUAGES.find((l) => l.code === lang),
    isLatin: lang === 'en',
  }), [lang, setLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext)
}
