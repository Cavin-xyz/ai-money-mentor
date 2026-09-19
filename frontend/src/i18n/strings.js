// UI strings for FinMind. The chosen language also sets the language of AI explanations
// (numbers, ₹ amounts and section numbers always stay as digits).
// English is the master list; a key missing from another locale falls back to English.
// Hindi, Telugu and Tamil were drafted by the dev team — have a native speaker review before the demo.
import en from './locales/en'
import hi from './locales/hi'
import te from './locales/te'
import ta from './locales/ta'

export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English', short: 'EN' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', short: 'हि' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu', short: 'తె' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', short: 'த' },
]

export const STRINGS = { en, hi, te, ta }
