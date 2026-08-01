export default function PrivacyPolicy() {
  return (
    <section className="py-4 sm:py-6 relative overflow-hidden">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-navy-900 mb-4">
          Privacy Policy
        </h1>
        <p className="text-navy-900/50 text-sm mb-10">Last updated: August 2026</p>

        <div className="prose prose-navy max-w-none space-y-8 text-navy-900/80">
          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">1. Overview</h2>
            <p>
              AIMoneyMentor ("we", "our", "the site") provides AI-powered financial planning tools,
              including the Tax Wizard, FIRE Planner, Health Score, Life Event Advisor, Couple Planner,
              and Portfolio X-Ray. This policy explains what data we collect, how we use it, and your
              choices.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">2. Information You Provide</h2>
            <p>
              When you use our AI chat tools, any financial details, documents, or messages you enter
              are sent to our backend server and forwarded to a third-party AI provider (Google Gemini)
              to generate a response. We do not sell this information. Uploaded documents (PDFs, images)
              are processed to generate advice and are not permanently stored unless stated otherwise in
              a specific tool.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">3. Automatically Collected Information</h2>
            <p>
              Like most websites, we may automatically collect standard technical information such as
              your IP address, browser type, device type, and pages visited, typically through hosting
              logs and, if enabled, analytics or advertising services.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">4. Cookies and Advertising</h2>
            <p>
              We may use third-party advertising services, such as Google AdSense, to display ads on
              this site. These services may use cookies or similar technologies to serve ads based on
              your prior visits to this or other websites. You can opt out of personalized advertising
              by visiting{" "}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-navy-900 underline"
              >
                Google Ads Settings
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">5. Third-Party Services</h2>
            <p>
              Our site relies on third-party providers to operate, including Google Gemini (AI
              responses) and our hosting provider, Render. These providers may process data according
              to their own privacy policies.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">6. Data Security</h2>
            <p>
              We take reasonable measures to protect information transmitted through our site, including
              HTTPS encryption. However, no method of transmission over the internet is 100% secure, and
              we cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">7. Children's Privacy</h2>
            <p>
              This site is not directed at children under 13, and we do not knowingly collect
              information from children under 13.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page
              with an updated revision date.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">9. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, you can reach out via the contact details
              provided on our site.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
