const SECTIONS = [
  ['1. Overview', 'Money Mentor provides financial planning tools — FIRE Planner, Money Health Score, Tax Wizard, Life Event Advisor, Couple\'s Planner, Portfolio X-Ray and Scam Shield. Everything runs on the computer where the app is installed: the AI model, the knowledge base and your saved data.'],
  ['2. Processing happens on this device', 'Numbers you enter are calculated by a local calculation engine. Explanations are written by an AI model running on this computer through Ollama. No prompt, document or financial detail is sent to a cloud AI provider.'],
  ['3. What is stored, and where', 'If you create a profile, your profile fields, goals, preferences and a short summary of each run are saved in a local SQLite file (data/mentor.db) on this computer. Nothing is stored if you don\'t create a profile. There is no account and no login.'],
  ['4. Uploaded documents', 'Form 16s, CAS statements and screenshots are read in memory to extract figures and are not saved. A statement password is used only to open the file and is never stored or logged.'],
  ['5. No ads, no trackers', 'The app loads no advertising, analytics or tracking scripts, and bundles its fonts locally, so it works with the internet switched off.'],
  ['6. Internet use', 'The app only goes online to refresh public data when a connection exists — AMFI\'s daily NAV file and official documents your team chooses to add to the knowledge base. No personal data is sent in those requests.'],
  ['7. Your control', 'Open your profile and choose Privacy → Delete my data to remove your profile, goals, history and preferences from this computer. You can also turn off "Remember my numbers" to stop forms updating your profile.'],
  ['8. India\'s DPDP Rules', 'The Digital Personal Data Protection Rules, 2025 phase in duties such as notice, security safeguards and breach reporting. Keeping data on your own device, collecting only what a tool needs and offering deletion are designed with those principles in mind.'],
  ['9. Not advice', 'Outputs are educational guidance, not investment, tax or legal advice. Verify important decisions with a SEBI-registered investment adviser or a Chartered Accountant.'],
]

export default function PrivacyPolicy() {
  return (
    <section className="py-4 sm:py-6 relative overflow-hidden">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-navy-900 mb-4">Privacy Policy</h1>
        <p className="text-navy-900/50 text-sm mb-10">Last updated: September 2026 · on-device edition</p>
        <div className="max-w-none space-y-8 text-navy-900/80">
          {SECTIONS.map(([h, body]) => (
            <div key={h}>
              <h2 className="text-xl font-bold text-navy-900 mb-2">{h}</h2>
              <p className="leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
