import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, UserRound, Target, History, Settings2, ShieldCheck, Trash2, Plus, RotateCcw, Flame, Activity, Calculator, Lightbulb, Users, ScanLine, MessageCircleQuestion, ShieldAlert, Check } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'
import { formatINRCompact, timeAgo } from '../lib/format'
import { LANGUAGES } from '../i18n/strings'

// Labels: drawer.tab.<key> and drawer.module.<module>
const TABS = [
  ['profile', UserRound],
  ['goals', Target],
  ['history', History],
  ['prefs', Settings2],
  ['privacy', ShieldCheck],
]

const MODULE_ICONS = {
  fire: Flame,
  'health-score': Activity,
  tax: Calculator,
  'life-event': Lightbulb,
  'couples-planner': Users,
  portfolio: ScanLine,
  ask: MessageCircleQuestion,
  'scam-shield': ShieldAlert,
}
const REOPENABLE = new Set(['fire', 'health-score', 'life-event', 'couples-planner', 'portfolio'])

// [field, input type]; labels are drawer.f.<field>
const PROFILE_FIELDS = [
  ['name', 'text'],
  ['age', 'number'],
  ['city', 'text'],
  ['monthlyIncome', 'number'],
  ['monthlyExpenses', 'number'],
  ['liquidSavings', 'number'],
  ['monthlyEmi', 'number'],
  ['lifeCover', 'number'],
  ['healthCover', 'number'],
  ['retirementCorpus', 'number'],
]

const input = 'w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:border-navy-900/30'

function ProfileForm({ profile, onSave, cta }) {
  const { t } = useLanguage()
  const [values, setValues] = useState(() => Object.fromEntries(PROFILE_FIELDS.map(([k]) => [k, profile?.[k] ?? ''])))
  const [dependents, setDependents] = useState(profile?.dependents || 'No')
  const [risk, setRisk] = useState(profile?.riskTolerance || 'balanced')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave({ ...values, dependents, riskTolerance: risk, name: values.name || 'Me' })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {PROFILE_FIELDS.map(([k, type]) => (
          <label key={k} className="block">
            <span className="block text-[11px] font-semibold text-navy-900/50 mb-1">{t(`drawer.f.${k}`)}</span>
            <input type={type} value={values[k]} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} className={input} />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] font-semibold text-navy-900/50 mb-1">{t('drawer.f.dependents')}</span>
          <select value={dependents} onChange={(e) => setDependents(e.target.value)} className={input}><option value="No">{t('common.no')}</option><option value="Yes">{t('common.yes')}</option></select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-navy-900/50 mb-1">{t('drawer.f.risk')}</span>
          <select value={risk} onChange={(e) => setRisk(e.target.value)} className={input}>
            {['conservative', 'balanced', 'aggressive'].map((s) => <option key={s} value={s}>{t(`drawer.style.${s}`)}</option>)}
          </select>
        </label>
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
        {saved ? <><Check size={14} /> {t('drawer.saved')}</> : cta}
      </button>
    </form>
  )
}

export default function ProfileDrawer() {
  const p = useProfile()
  const { drawer, closeDrawer, setDrawerTab } = p
  const { lang, setLang, t, p: phrase } = useLanguage()
  const panelRef = useRef(null)
  const [goal, setGoal] = useState({ name: '', amount: '', years: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)

  useEffect(() => {
    if (!drawer.open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') closeDrawer()
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll('button, input, select, [href]')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    setTimeout(() => panelRef.current?.querySelector('button, input')?.focus(), 50)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [drawer.open, closeDrawer])

  const addGoal = async (e) => {
    e.preventDefault()
    if (!goal.name || !Number(goal.amount) || !Number(goal.years)) return
    await p.addGoal({ name: goal.name, amount: Number(goal.amount), years: Number(goal.years) })
    setGoal({ name: '', amount: '', years: '' })
  }

  const doDelete = async () => {
    await p.deleteEverything()
    setConfirmDelete(false)
    setDeleted(true)
    setTimeout(() => setDeleted(false), 3000)
  }

  return createPortal(
    <AnimatePresence>
      {drawer.open && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" onClick={closeDrawer} />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('drawer.aria')}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="absolute right-0 top-0 h-full w-full sm:w-[440px] bg-cream shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-navy-900/[0.08] bg-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-navy-900/40">{t('drawer.header')}</p>
                <p className="text-base font-bold text-navy-900">{p.hasProfile ? p.profile.name : t('drawer.create')}</p>
              </div>
              <button onClick={closeDrawer} className="p-2 rounded-lg hover:bg-navy-900/[0.05] text-navy-900/50" aria-label={t('common.close')}><X size={18} /></button>
            </div>

            {deleted && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{t('drawer.deleted')}</div>
            )}

            {!p.hasProfile ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <p className="text-sm text-navy-900/60">{t('drawer.intro')}</p>
                <ProfileForm profile={null} onSave={p.create} cta={t('drawer.createCta')} />
              </div>
            ) : (
              <>
                <div className="flex gap-1 px-3 pt-3 overflow-x-auto" role="tablist">
                  {TABS.map(([key, Icon]) => (
                    <button key={key} role="tab" aria-selected={drawer.tab === key} onClick={() => setDrawerTab(key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${drawer.tab === key ? 'bg-navy-900 text-white' : 'text-navy-900/55 hover:bg-navy-900/[0.05]'}`}>
                      <Icon size={13} /> {t(`drawer.tab.${key}`)}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {drawer.tab === 'profile' && <ProfileForm key={p.profile.updatedAt} profile={p.profile} onSave={p.update} cta={t('drawer.saveCta')} />}

                  {drawer.tab === 'goals' && (
                    <div className="space-y-3">
                      <p className="text-xs text-navy-900/50">{t('drawer.goalsIntro')}</p>
                      {p.goals.map((g) => (
                        <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-navy-900/[0.08]">
                          <div>
                            <p className="text-sm font-semibold text-navy-900">{g.name}</p>
                            <p className="text-[11px] text-navy-900/45">{t('drawer.goalLine', { amount: formatINRCompact(g.amount), years: g.years })}</p>
                          </div>
                          <button onClick={() => p.deleteGoal(g.id)} className="p-2 rounded-lg text-navy-900/35 hover:text-red-500 hover:bg-red-50" aria-label={t('drawer.deleteGoal', { name: g.name })}><Trash2 size={14} /></button>
                        </div>
                      ))}
                      <form onSubmit={addGoal} className="p-3 rounded-xl border border-dashed border-navy-900/20 space-y-2">
                        <input value={goal.name} onChange={(e) => setGoal((g) => ({ ...g, name: e.target.value }))} placeholder={t('drawer.goalName')} className={input} aria-label={t('drawer.goalName')} />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={goal.amount} onChange={(e) => setGoal((g) => ({ ...g, amount: e.target.value }))} placeholder={t('drawer.goalAmount')} inputMode="numeric" className={input} aria-label={t('drawer.goalAmount')} />
                          <input value={goal.years} onChange={(e) => setGoal((g) => ({ ...g, years: e.target.value }))} placeholder={t('drawer.goalYears')} inputMode="numeric" className={input} aria-label={t('drawer.goalYears')} />
                        </div>
                        <button type="submit" className="btn-ghost w-full text-xs flex items-center justify-center gap-1.5"><Plus size={13} /> {t('drawer.addGoal')}</button>
                      </form>
                    </div>
                  )}

                  {drawer.tab === 'history' && (
                    <div className="space-y-2">
                      {!p.history.length && <p className="text-sm text-navy-900/50">{t('drawer.historyEmpty')}</p>}
                      {p.history.map((h) => {
                        const Icon = MODULE_ICONS[h.module] || History
                        const label = MODULE_ICONS[h.module] ? t(`drawer.module.${h.module}`) : h.module
                        return (
                          <div key={h.id} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-navy-900/[0.08]">
                            <span className="w-8 h-8 rounded-lg bg-navy-900/[0.05] flex items-center justify-center flex-shrink-0"><Icon size={14} className="text-navy-900/60" /></span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-navy-900/50">{label} · {timeAgo(h.createdAt, t)}</p>
                              <p className="text-xs text-navy-900 leading-snug">{phrase(h.summary)}</p>
                            </div>
                            {REOPENABLE.has(h.module) && (
                              <button onClick={() => p.reopen(h.id)} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline flex-shrink-0"><RotateCcw size={11} /> {t('drawer.reopen')}</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {drawer.tab === 'prefs' && (
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs font-bold text-navy-900 mb-2">{t('drawer.langTitle')}</p>
                        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('drawer.langTitle')}>
                          {LANGUAGES.map((l) => (
                            <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)} lang={l.code}
                              className={`px-3 py-2.5 rounded-xl border text-sm font-semibold ${lang === l.code ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-900/10 bg-white text-navy-900/70'}`}>
                              {l.native}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-navy-900/45 mt-2">{t('lang.note')}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-navy-900 mb-2">{t('drawer.styleTitle')}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {['conservative', 'balanced', 'aggressive'].map((s) => (
                            <button key={s} onClick={() => p.updatePrefs({ investmentStyle: s })}
                              className={`px-2 py-2 rounded-xl border text-xs font-semibold ${p.prefs.investmentStyle === s ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-900/10 bg-white text-navy-900/70'}`}>{t(`drawer.style.${s}`)}</button>
                          ))}
                        </div>
                        <p className="text-[11px] text-navy-900/45 mt-2">{t('drawer.styleNote')}</p>
                      </div>
                      <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-navy-900/[0.08]">
                        <span className="text-xs font-semibold text-navy-900">{t('drawer.reminders')}</span>
                        <input type="checkbox" checked={!!p.prefs.notifications} onChange={(e) => p.updatePrefs({ notifications: e.target.checked })} className="accent-navy-900" />
                      </label>
                    </div>
                  )}

                  {drawer.tab === 'privacy' && (
                    <div className="space-y-4">
                      <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white border border-navy-900/[0.08]">
                        <span>
                          <span className="block text-xs font-bold text-navy-900">{t('drawer.remember')}</span>
                          <span className="block text-[11px] text-navy-900/50">{t('drawer.rememberSub')}</span>
                        </span>
                        <input type="checkbox" checked={!!p.profile.rememberNumbers} onChange={(e) => p.update({ rememberNumbers: e.target.checked })} className="accent-navy-900 mt-1" />
                      </label>
                      <div className="p-3 rounded-xl bg-white border border-navy-900/[0.08] text-[11px] text-navy-900/60 space-y-1">
                        <p className="font-bold text-navy-900 text-xs">{t('drawer.storedTitle')}</p>
                        <p>{t('drawer.stored1')}</p>
                        <p>{t('drawer.stored2')}</p>
                        <p>{t('drawer.stored3')}</p>
                      </div>
                      {!confirmDelete ? (
                        <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">
                          <Trash2 size={14} /> {t('drawer.delete')}
                        </button>
                      ) : (
                        <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
                          <p className="text-xs text-red-800">{t('drawer.deleteConfirm')}</p>
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 text-xs">{t('drawer.cancel')}</button>
                            <button onClick={doDelete} className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700">{t('drawer.deleteAll')}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
