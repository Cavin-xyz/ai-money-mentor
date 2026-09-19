import { useLanguage } from '../context/LanguageContext'

// Section copy: privacy.<n>h (heading) and privacy.<n>b (body)
const SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function PrivacyPolicy() {
  const { t } = useLanguage()
  return (
    <section className="py-4 sm:py-6 relative overflow-hidden">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-navy-900 mb-4">{t('privacy.title')}</h1>
        <p className="text-navy-900/50 text-sm mb-10">{t('privacy.updated')}</p>
        <div className="max-w-none space-y-8 text-navy-900/80">
          {SECTIONS.map((n) => (
            <div key={n}>
              <h2 className="text-xl font-bold text-navy-900 mb-2">{t(`privacy.${n}h`)}</h2>
              <p className="leading-relaxed">{t(`privacy.${n}b`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
