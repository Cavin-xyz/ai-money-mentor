// Indian number formatting: lakhs and crores.

const full = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** ₹1,48,750 */
export function formatINR(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return `₹${full.format(Math.round(Number(n)))}`
}

/** ₹1.49L, ₹3.2Cr, ₹48K — for chart axes, tiles and tooltips */
export function formatINRCompact(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7)}Cr`
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5)}L`
  if (a >= 1e3) return `${sign}₹${trim(a / 1e3)}K`
  return `${sign}₹${Math.round(a)}`
}

function trim(x) {
  return x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1).replace(/\.0$/, '') : x.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')
}

export function formatPct(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toFixed(digits).replace(/\.0$/, '')}%`
}

/** "5 min ago" — `t` is the i18n lookup from useLanguage(). */
export function timeAgo(iso, t) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return t('time.now')
  if (diff < 3600) return t('time.min', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('time.h', { n: Math.floor(diff / 3600) })
  return t('time.d', { n: Math.floor(diff / 86400) })
}

/** "Sec 123 (formerly 80C)" for a citation, or null. `t` is the i18n lookup from useLanguage(). */
export function sectionLabel(c, t) {
  if (!c?.section) return null
  return c.sectionOld ? t('sources.secFormerly', { s: c.section, o: c.sectionOld }) : t('sources.sec', { s: c.section })
}
