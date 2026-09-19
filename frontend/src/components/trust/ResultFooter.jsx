import ExplainPanel from './ExplainPanel'
import SourceChips from './SourceChips'
import AskBox from './AskBox'
import { TrustBadge, ModelBadge, Disclaimer } from './Badges'
import { useLanguage } from '../../context/LanguageContext'

/**
 * The same footer under every module's results: trust + model badges, "How we calculated this",
 * source chips, "Ask about this" and the disclaimer — the Explainable Recommendation box of the diagram.
 */
export default function ResultFooter({ meta, citations, module, askContext, suggestions, pending = false }) {
  const { t } = useLanguage()
  if (!meta) return null
  const cites = citations ?? meta.citations ?? []
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {pending ? (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-navy-900/10 bg-white text-[11px] text-navy-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> {t('trust.pending')}
          </span>
        ) : (
          <TrustBadge trust={meta.trust} />
        )}
        <ModelBadge model={meta.model} latencyMs={pending ? null : meta.latencyMs} />
      </div>
      <ExplainPanel calculations={meta.calculations} assumptions={meta.assumptions} />
      <div className="glass-card px-5 py-3.5">
        <SourceChips citations={cites} />
      </div>
      {!pending && <AskBox module={module} context={askContext} suggestions={suggestions} />}
      <Disclaimer />
    </div>
  )
}
