import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Sparkles, RefreshCw, Scale, Landmark, Home } from 'lucide-react'
import { useAdvisorStream } from '../hooks/useAdvisorStream'
import { useProfile } from '../context/ProfileContext'
import { formatINR } from '../lib/format'
import PipelineProgress from './trust/PipelineProgress'
import { useLanguage } from '../context/LanguageContext'
import ResultFooter from './trust/ResultFooter'

// Names start blank; the placeholder (and the request, if left blank) uses "Partner 1/2" in the chosen language.
const defaultPartner = () => ({ name: '', salary: '', declarations80C: '', investments: '', rent: '', healthPremium: '' })

function ImpactBadge({ type, label }) {
  const styles = {
    high: 'bg-red-50 text-red-600 border-red-200',
    retirement: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    portfolio: 'bg-blue-50 text-blue-600 border-blue-200',
  }
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${styles[type] || styles.high}`}>{label}</span>
}

function MoneyField({ label, value, onChange, placeholder, optional }) {
  const { t } = useLanguage()
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-navy-900/40 uppercase tracking-wider">{label}{optional && <span className="normal-case tracking-normal font-normal"> · {t('common.optional')}</span>}</span>
      <span className="mt-1 flex items-center bg-navy-900/[0.03] border border-navy-900/10 rounded-xl overflow-hidden">
        <span className="pl-3 text-sm text-navy-900/40 font-mono">₹</span>
        <input type="text" inputMode="numeric" value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-transparent px-2 py-2.5 text-sm text-navy-900 font-bold font-mono focus:outline-none" />
      </span>
    </label>
  )
}

export default function CouplesMoneyPlanner() {
  const { restoreRequest, refresh } = useProfile()
  const { t, p } = useLanguage()
  const stream = useAdvisorStream('/api/couples-planner/stream')
  const [partners, setPartners] = useState({ partner1: defaultPartner(), partner2: defaultPartner() })
  const [joint, setJoint] = useState({ jointHomeLoan: false, homeLoanInterest: '', sharedExpenses: '' })
  const [split, setSplit] = useState('proportional')
  const [error, setError] = useState(null)

  const { restore, status } = stream
  useEffect(() => {
    if (restoreRequest?.module === 'couples-planner') {
      restore(restoreRequest.result)
      document.getElementById('couples')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [restoreRequest, restore])
  useEffect(() => {
    if (status === 'done') refresh()
  }, [status, refresh])

  const updatePartner = useCallback((key, field, value) => {
    setPartners((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }, [])

  const generate = () => {
    if (!partners.partner1.salary || !partners.partner2.salary) {
      setError('couples.errSalary')
      return
    }
    setError(null)
    const named = (key, n) => ({ ...partners[key], name: partners[key].name.trim() || t('couples.partnerN', { n }) })
    stream.run({ partner1: named('partner1', 1), partner2: named('partner2', 2), ...joint })
  }

  const data = stream.data
  const pending = stream.running && !stream.result
  const selectedSplit = data?.splits?.find((s) => s.key === split)
  const names = data?.partners?.map((x) => x.name) || [partners.partner1.name || t('couples.partnerN', { n: 1 }), partners.partner2.name || t('couples.partnerN', { n: 2 })]

  return (
    <section id="couples" className="py-16 relative scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="section-tag mx-auto mb-4"><Users size={11} /> {t('couples.tag')}</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">{t('couples.title')}</h1>
          <p className="text-navy-900/50 text-base mt-2 max-w-xl mx-auto">
            {t('couples.sub')}
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8 mb-6">
          <h2 className="text-base font-bold text-navy-900 mb-6">{t('couples.both')}</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {['partner1', 'partner2'].map((key, idx) => {
              const partner = partners[key]
              const placeholder = t('couples.partnerN', { n: idx + 1 })
              const result = data?.partners?.[idx]
              const avatarColor = idx === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              return (
                <div key={key}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center font-bold text-sm`}>{(partner.name || placeholder).charAt(0)}</div>
                    <input type="text" value={partner.name} onChange={(e) => updatePartner(key, 'name', e.target.value)} aria-label={t('couples.nameAria', { n: idx + 1 })} className="text-sm font-bold text-navy-900 bg-transparent border-none p-0 focus:outline-none w-32 placeholder-navy-900/60" placeholder={placeholder} />
                    {result && (
                      <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {t('couples.badge', { regime: t(result.bestRegime === 'Old' ? 'tax.old' : 'tax.new'), rate: result.marginalRate })}
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <MoneyField label={t('couples.f.salary')} value={partner.salary} onChange={(e) => updatePartner(key, 'salary', e.target.value)} placeholder={t('common.eg', { v: 120000 })} />
                    <MoneyField label={t('couples.f.investments')} value={partner.investments} onChange={(e) => updatePartner(key, 'investments', e.target.value)} placeholder={t('common.eg', { v: 25000 })} />
                    <MoneyField label={t('couples.f.80c')} value={partner.declarations80C} onChange={(e) => updatePartner(key, 'declarations80C', e.target.value)} placeholder={t('common.eg', { v: 150000 })} />
                    <div className="grid grid-cols-2 gap-3">
                      <MoneyField label={t('couples.f.rent')} optional value={partner.rent} onChange={(e) => updatePartner(key, 'rent', e.target.value)} placeholder="0" />
                      <MoneyField label={t('couples.f.health')} optional value={partner.healthPremium} onChange={(e) => updatePartner(key, 'healthPremium', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-navy-900/[0.06] grid sm:grid-cols-3 gap-3 items-end">
            <MoneyField label={t('couples.f.shared')} optional value={joint.sharedExpenses} onChange={(e) => setJoint((j) => ({ ...j, sharedExpenses: e.target.value }))} placeholder={t('common.eg', { v: 80000 })} />
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-navy-900/10 bg-navy-900/[0.02] cursor-pointer">
              <input type="checkbox" checked={joint.jointHomeLoan} onChange={(e) => setJoint((j) => ({ ...j, jointHomeLoan: e.target.checked }))} className="accent-navy-900" />
              <span className="text-xs font-semibold text-navy-900/70 flex items-center gap-1"><Home size={12} /> {t('couples.f.joint')}</span>
            </label>
            {joint.jointHomeLoan && (
              <MoneyField label={t('couples.f.loanInterest')} value={joint.homeLoanInterest} onChange={(e) => setJoint((j) => ({ ...j, homeLoanInterest: e.target.value }))} placeholder={t('common.eg', { v: 400000 })} />
            )}
          </div>

          <button onClick={generate} disabled={stream.running} className="btn-primary w-full mt-6 flex items-center justify-center gap-2 text-sm disabled:opacity-60">
            <Sparkles size={14} /> {stream.running ? t('common.working') : t('couples.run')}
          </button>
          {error && <p className="mt-3 text-xs text-red-500 text-center">{t(error)}</p>}
        </div>

        {stream.status !== 'idle' && (
          <div className="mb-5"><PipelineProgress stages={stream.stages} status={stream.status} citations={stream.citations} trust={stream.result?.meta?.trust} /></div>
        )}
        {stream.status === 'error' && <div className="glass-card p-5 text-sm text-red-600 text-center mb-5">{t(stream.error)}</div>}

        <AnimatePresence>
          {data && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Household tax */}
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  ['couples.h.now', data.household?.taxNow, 'text-navy-900'],
                  ['couples.h.after', data.household?.taxOptimized, 'text-emerald-700'],
                  ['couples.h.saving', data.household?.saving, 'text-emerald-600'],
                ].map(([l, v, c]) => (
                  <div key={l} className="glass-card p-4 text-center">
                    <p className="text-[9px] font-bold text-navy-900/40 uppercase tracking-wider flex items-center justify-center gap-1"><Landmark size={11} /> {t(l)}</p>
                    <p className={`text-lg font-extrabold font-mono ${c}`}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Insights */}
              <div className="glass-card p-6 sm:p-8">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-navy-900/40" />
                    <h2 className="text-base font-bold text-navy-900">{t('couples.moves')}</h2>
                  </div>
                  <button onClick={generate} disabled={stream.running} className="p-1.5 rounded-lg hover:bg-navy-900/[0.05] text-navy-900/40 hover:text-navy-900" aria-label={t('couples.recalc')}>
                    <RefreshCw size={14} className={stream.running ? 'animate-spin' : ''} />
                  </button>
                </div>
                <div className="space-y-3">
                  {data.insights?.map((item) => (
                    <div key={item.key} className="p-4 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[10px] font-bold text-navy-900/50 uppercase tracking-wider">{p(item.category)}</p>
                        <ImpactBadge type={item.impactType} label={p(item.impactLabel)} />
                      </div>
                      <p className={`text-sm text-navy-900/65 leading-relaxed ${pending ? 'animate-pulse' : ''}`}>{p(item.insight)}</p>
                      {item.estimatedSaving && <p className="text-xs font-bold text-emerald-600 mt-2">{t('couples.saves', { amount: item.estimatedSaving })}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Expense split */}
              {data.splits?.length > 0 && (
                <div className="glass-card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2"><Scale size={14} className="text-navy-900/40" /> {t('couples.split.title', { amount: formatINR(data.sharedExpenses) })}</h3>
                    <div role="radiogroup" aria-label={t('couples.split.aria')} className="inline-flex p-1 rounded-xl bg-navy-900/[0.05] border border-navy-900/10">
                      {data.splits.map((s) => (
                        <button key={s.key} role="radio" aria-checked={split === s.key} onClick={() => setSplit(s.key)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold ${split === s.key ? 'bg-white shadow-sm text-navy-900' : 'text-navy-900/50'}`}>
                          {t(`couples.split.${s.key}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedSplit && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {[[names[0], selectedSplit.partner1, selectedSplit.leftover1, 'bg-emerald-500'], [names[1], selectedSplit.partner2, selectedSplit.leftover2, 'bg-blue-500']].map(([n, pays, left, bar]) => {
                        const max = Math.max(selectedSplit.leftover1, selectedSplit.leftover2, 1)
                        return (
                          <div key={n} className="p-4 rounded-xl bg-navy-900/[0.02] border border-navy-900/[0.06]">
                            <p className="text-xs font-bold text-navy-900">{n}</p>
                            <p className="text-[11px] text-navy-900/50 mt-1">{t('couples.split.pays', { amount: formatINR(pays) })}</p>
                            <p className="text-[11px] text-navy-900/50">{t('couples.split.left', { amount: formatINR(left) })}</p>
                            <div className="mt-2 h-2 rounded-full bg-navy-900/[0.06] overflow-hidden">
                              <motion.div className={`h-full ${bar}`} animate={{ width: `${Math.max(0, left) / max * 100}%` }} transition={{ duration: 0.4 }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <ResultFooter
                meta={data.meta}
                citations={stream.citations}
                pending={pending}
                module="couples-planner"
                askContext={`Household tax ${data.household?.taxNow} → ${data.household?.taxOptimized}; partners: ${data.partners?.map((x) => `${x.name} ${x.bestRegime} regime`).join(', ')}`}
                suggestions={[t('couples.ask.1'), t('couples.ask.2'), t('couples.ask.3')]}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
