import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Landmark, Sparkles, ExternalLink, ShieldCheck, PiggyBank, Baby, Users, BadgeIndianRupee, ChevronDown, UserRound, AlertTriangle,
} from 'lucide-react'
import { useAdvisorStream } from '../hooks/useAdvisorStream'
import { useProfile, profileValues } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'
import PipelineProgress from './trust/PipelineProgress'
import ResultFooter from './trust/ResultFooter'

const PROFILE_MAP = { age: 'age', monthlyIncome: 'monthlyIncome', dependents: 'dependents', lifeCover: 'lifeCover' }

const CATEGORY_ICON = {
  insurance: ShieldCheck,
  retirement: PiggyBank,
  children: Baby,
  seniors: Users,
  savings: BadgeIndianRupee,
}

const field = 'w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-3 py-2.5 text-navy-900 font-bold text-sm focus:outline-none focus:border-navy-900/30 font-mono'

/**
 * Government schemes matched to the person by the rules engine — the module for someone who does
 * not know these schemes exist. Eligibility is decided in Java; the local model only explains it.
 */
export default function SchemesForYou() {
  const { profile, hasProfile, restoreRequest, refresh } = useProfile()
  const { t, p } = useLanguage()
  const stream = useAdvisorStream('/api/schemes/stream')
  const [form, setForm] = useState({
    age: '', monthlyIncome: '', dependents: 'No', hasEpf: 'No', workplacePension: 'No',
    girlChildAge: '', childAge: '', seniorParentAge: '',
  })
  const [error, setError] = useState(null)
  const [showBlocked, setShowBlocked] = useState(false)

  const { restore, status } = stream
  useEffect(() => {
    if (restoreRequest?.module === 'schemes') {
      restore(restoreRequest.result)
      document.getElementById('schemes')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [restoreRequest, restore])
  useEffect(() => {
    if (status === 'done') refresh()
  }, [status, refresh])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const data = stream.data
  const pending = stream.running && !stream.result

  const run = () => {
    if (!form.age) {
      setError('schemes.errAge')
      return
    }
    setError(null)
    stream.run({ ...form, lifeCover: profile?.lifeCover ?? '' })
  }

  const toggle = (k, label) => (
    <div>
      <span className="block text-[11px] font-semibold text-navy-900/45 mb-1">{t(label)}</span>
      <div className="flex gap-2">
        {['Yes', 'No'].map((opt) => (
          <button
            key={opt}
            onClick={() => set(k, opt)}
            className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${form[k] === opt ? 'border-navy-900 bg-navy-900/[0.06] text-navy-900' : 'border-navy-900/10 bg-navy-900/[0.02] text-navy-900/50'}`}
          >
            {t(opt === 'Yes' ? 'common.yes' : 'common.no')}
          </button>
        ))}
      </div>
    </div>
  )

  const number = (k, label, placeholder) => (
    <label className="block">
      <span className="block text-[11px] font-semibold text-navy-900/45 mb-1">{t(label)}</span>
      <input inputMode="numeric" value={form[k]} onChange={(e) => set(k, e.target.value)} className={field}
        placeholder={placeholder ? t('common.eg', { v: placeholder }) : t('common.optional')} />
    </label>
  )

  return (
    <section id="schemes" className="py-20 relative scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="section-tag mx-auto mb-4"><Landmark size={11} /> {t('schemes.tag')}</div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-navy-900">
            {t('schemes.title')} <span className="gradient-text">{t('schemes.titleAccent')}</span>
          </h2>
          <p className="mt-4 text-navy-900/50 max-w-2xl mx-auto">{t('schemes.sub')}</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-5 items-start">
          {/* Who you are */}
          <div className="lg:col-span-2 glass-card p-5 space-y-3.5">
            {hasProfile && (
              <button onClick={() => setForm((f) => ({ ...f, ...profileValues(profile, PROFILE_MAP) }))}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-navy-900/[0.04] border border-navy-900/10 text-xs font-semibold text-navy-900/70 hover:bg-navy-900/[0.07]">
                <UserRound size={13} /> {t('common.useSaved')}
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              {number('age', 'schemes.f.age', 29)}
              {number('monthlyIncome', 'schemes.f.income', 120000)}
            </div>
            {toggle('dependents', 'schemes.f.dependents')}
            <div className="grid grid-cols-2 gap-3">
              {toggle('hasEpf', 'schemes.f.epf')}
              {toggle('workplacePension', 'schemes.f.pension')}
            </div>
            <p className="text-[10px] text-navy-900/35 pt-1">{t('schemes.optionalNote')}</p>
            <div className="grid grid-cols-3 gap-2">
              {number('girlChildAge', 'schemes.f.girlChild')}
              {number('childAge', 'schemes.f.child')}
              {number('seniorParentAge', 'schemes.f.parent')}
            </div>
            <button onClick={run} disabled={stream.running} className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              <Sparkles size={14} /> {stream.running ? t('common.working') : t('schemes.run')}
            </button>
            {error && <p className="text-xs text-red-500 text-center">{t(error)}</p>}
            <p className="text-[10px] text-navy-900/35">{t('schemes.privacyNote')}</p>
          </div>

          {/* What you qualify for */}
          <div className="lg:col-span-3 space-y-4">
            {stream.status === 'idle' && (
              <div className="glass-card p-8 text-center min-h-[280px] flex flex-col items-center justify-center">
                <Landmark size={30} className="text-navy-900/20 mb-3" />
                <p className="text-sm text-navy-900/45 max-w-sm">{t('schemes.emptyHint')}</p>
              </div>
            )}
            {stream.status !== 'idle' && (
              <PipelineProgress stages={stream.stages} status={stream.status} citations={stream.citations} trust={stream.result?.meta?.trust} />
            )}
            {stream.status === 'error' && <div className="glass-card p-5 text-sm text-red-600 text-center">{t(stream.error)}</div>}

            <AnimatePresence>
              {data && (
                <motion.div key="res" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="glass-card p-5">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">{t('schemes.yourMatches')}</p>
                    <p className={`text-lg font-bold text-navy-900 leading-snug ${pending ? 'animate-pulse' : ''}`}>{p(data.headline)}</p>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      {[
                        ['schemes.tile.count', data.eligibleCount],
                        ['schemes.tile.cost', data.totalAnnualCost],
                        ['schemes.tile.cover', data.totalCover],
                      ].map(([label, value]) => (
                        <div key={label} className="p-3 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.05]">
                          <p className="text-[10px] text-navy-900/40 uppercase tracking-wider font-bold">{t(label)}</p>
                          <p className="text-base font-extrabold text-navy-900 font-mono">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(data.schemes || []).map((s) => {
                    const Icon = CATEGORY_ICON[s.category] || Landmark
                    return (
                      <div key={s.id} className="glass-card p-5">
                        <div className="flex items-start gap-3">
                          <span className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Icon size={16} className="text-emerald-600" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-bold text-navy-900">{s.name}</p>
                              <span className="text-[11px] font-mono font-bold text-navy-900 whitespace-nowrap">{s.cost}</span>
                            </div>
                            <p className="text-xs text-navy-900/55 mt-1">{p(s.what)}</p>
                            <p className={`text-xs text-navy-900/75 mt-2 leading-relaxed ${pending ? 'animate-pulse' : ''}`}>{p(s.why)}</p>
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-navy-900/[0.04] border border-navy-900/10 text-navy-900/60">{p(s.reason)}</span>
                              {s.benefit !== '—' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">{t('schemes.gives', { amount: s.benefit })}</span>}
                              {s.section && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-amber-800">{p(s.section)}</span>}
                            </div>
                            <p className="mt-2.5 text-[11px] text-navy-900/50">{t('schemes.howTo')}: {p(s.action)}</p>
                            <a href={s.source} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline">
                              {p(s.authority)} <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {data.unverified && (
                    <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {t('schemes.unverified')}
                    </p>
                  )}

                  {(data.notEligible || []).length > 0 && (
                    <div className="glass-card overflow-hidden">
                      <button onClick={() => setShowBlocked((b) => !b)} aria-expanded={showBlocked}
                        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-navy-900/[0.02]">
                        <span className="text-xs font-bold text-navy-900">{t('schemes.notEligible', { n: data.notEligible.length })}</span>
                        <ChevronDown size={14} className={`text-navy-900/40 transition-transform ${showBlocked ? 'rotate-180' : ''}`} />
                      </button>
                      {showBlocked && (
                        <div className="px-5 pb-4 space-y-1.5 border-t border-navy-900/[0.06] pt-3">
                          {data.notEligible.map((s) => (
                            <div key={s.id} className="flex items-start justify-between gap-3 text-[11px]">
                              <span className="text-navy-900/70 font-semibold">{s.short}</span>
                              <span className="text-navy-900/45 text-right">{p(s.reason)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <ResultFooter
                    meta={data.meta}
                    citations={stream.citations}
                    pending={pending}
                    module="schemes"
                    askContext={`Eligible schemes: ${(data.schemes || []).map((s) => s.short).join(', ')}`}
                    suggestions={[t('schemes.ask.1'), t('schemes.ask.2'), t('schemes.ask.3')]}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
