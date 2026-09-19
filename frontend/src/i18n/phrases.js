// Fixed English text the backend sends — stage details, safety checks, calculation-step labels,
// priorities, categories — translated in the browser. Each phrasebook is keyed by the English text;
// PATTERNS turn dynamic sentences into templates ("Expenses at age {1}") that are looked up the same way.
// Anything not in the phrasebook is shown as sent.
import hi from './phrases/hi'
import te from './phrases/te'
import ta from './phrases/ta'

const BOOKS = { hi, te, ta }
const SENTENCE = /(?<=[.!?])\s+(?=[A-Z₹])/

const PATTERNS = [
  // pipeline stages
  [/^(\d+) calculation steps$/, '{1} calculation steps'],
  [/^(\d+) official passages$/, '{1} official passages'],
  [/^Asking the model to fix: (.+)$/, 'Asking the model to fix: {1}', true],
  [/^(\d+)\/(\d+) checks passed$/, '{1}/{2} checks passed'],
  [/^(\d+) characters$/, '{1} characters'],
  // safety checks and warnings
  [/^(\d+) citation\(s\) to (\d+) retrieved source\(s\)$/, '{1} citation(s) to {2} retrieved source(s)'],
  [/^(\d+) citation\(s\) to (\d+) retrieved source\(s\); removed (\d+) invalid$/, '{1} citation(s) to {2} retrieved source(s); removed {3} invalid'],
  [/^(\d+) ₹ figure\(s\) verified against the engine$/, '{1} ₹ figure(s) verified against the engine'],
  [/^Not from calculator: (.+)$/, 'Not from calculator: {1}'],
  [/^Named fund house\(s\): (.+)$/, 'Named fund house(s): {1}'],
  [/^Agrees that the (new|old) regime is better$/, 'Agrees that the {1} regime is better', true],
  [/^Removed (\d+) citation\(s\) that did not match a retrieved source$/, 'Removed {1} citation(s) that did not match a retrieved source'],
  [/^Some ₹ figures in this answer were not produced by the calculator: (.+)$/, 'Some ₹ figures in this answer were not produced by the calculator: {1}'],
  // calculation steps
  [/^Expenses at age (\d+)$/, 'Expenses at age {1}'],
  [/^Corpus needed at (\d+)$/, 'Corpus needed at {1}'],
  [/^Proportional share of (.+)$/, 'Proportional share of {1}'],
  [/^(.+) in (\d+) yrs$/, '{1} in {2} yrs'],
  [/^Employer NPS (.+)$/, 'Employer NPS {1}'],
  [/^Slab (.+) @ (.+)$/, 'Slab {1} @ {2}'],
  [/^Rebate · Sec (\S+) \(formerly (.+)\)$/, 'Rebate · Sec {1} (formerly {2})'],
  [/^Rebate · Sec (\S+)$/, 'Rebate · Sec {1}'],
  [/^Funds \(matched to AMFI list, NAV date (.+)\)$/, 'Funds (matched to AMFI list, NAV date {1})'],
  [/^Degree cost in (\d+) years$/, 'Degree cost in {1} years'],
  [/^(.+) deduction$/, '{1} deduction', true],
  // schemes
  [/^You are short (.+) of term cover$/, 'You are short {1} of term cover'],
  [/^Adds (.+) on top of your existing cover$/, 'Adds {1} on top of your existing cover'],
  [/^The cheapest life cover available to you at (\d+)$/, 'The cheapest life cover available to you at {1}'],
  [/^An extra (.+) deduction of its own in the old regime$/, 'An extra {1} deduction of its own in the old regime'],
  [/^No workplace pension, and you are (\d+) — inside the (\d+)–(\d+) window$/, 'No workplace pension, and you are {1} — inside the {2}–{3} window'],
  [/^A daughter aged (\d+) can hold an account until she is 21$/, 'A daughter aged {1} can hold an account until she is 21'],
  [/^A child aged (\d+) has (\d+) years of compounding before the account is theirs$/, 'A child aged {1} has {2} years of compounding before the account is theirs'],
  [/^You are (\d+) — above the (\d+) threshold$/, 'You are {1} — above the {2} threshold'],
  [/^Your parent is (\d+) — above the (\d+) threshold$/, 'Your parent is {1} — above the {2} threshold'],
  [/^Everyone aged (\d+)\+ qualifies, whatever their income$/, 'Everyone aged {1}+ qualifies, whatever their income'],
  [/^Your parent aged (\d+) qualifies, whatever their income$/, 'Your parent aged {1} qualifies, whatever their income'],
  [/^Open between (\d+) and (\d+)$/, 'Open between {1} and {2}'],
  [/^For a daughter under (\d+)$/, 'For a daughter under {1}'],
  [/^Your daughter is over (\d+)$/, 'Your daughter is over {1}'],
  [/^For a child under (\d+)$/, 'For a child under {1}'],
  [/^Your child is over (\d+)$/, 'Your child is over {1}'],
  [/^For people aged (\d+) and above$/, 'For people aged {1} and above'],
  [/^(\d+) government schemes fit your details\. Start with (.+)\.$/, '{1} government schemes fit your details. Start with {2}.'],
  [/^(\d+) schemes fit, (.+)\/yr for (.+) of cover$/, '{1} schemes fit, {2}/yr for {3} of cover'],
  [/^min\(old, new\) on (.+)$/, 'min(old, new) on {1}'],
  [/^needed − current (.+)$/, 'needed − current {1}'],
  [/^(\d+) years$/, '{1} years'],
  // calculation formulas
  [/^better regime on (.+)$/, 'better regime on {1}'],
  [/^current (.+) \+ half of surplus \((.+)\/mo\) at (.+)$/, 'current {1} + half of surplus ({2}/mo) at {3}'],
  [/^equity @ (.+) for 18 years$/, 'equity @ {1} for 18 years'],
  [/^expenses inflated at (.+) ÷ (.+)$/, 'expenses inflated at {1} ÷ {2}'],
  [/^investing (.+)\/mo until corpus ≥ inflating target$/, 'investing {1}/mo until corpus ≥ inflating target'],
  [/^min\(interest, (.+)\)$/, 'min(interest, {1})'],
  [/^min\(claimed, (.+)\)$/, 'min(claimed, {1})'],
  [/^months ÷ (\d+) × 100 \(max 100\)$/, 'months ÷ {1} × 100 (max 100)'],
  [/^on (.+) \(income treated as gross\)$/, 'on {1} (income treated as gross)'],
  [/^rounded to nearest ₹(\d+)$/, 'rounded to nearest ₹{1}'],
  [/^solved so projected corpus at (\d+) = FIRE number$/, 'solved so projected corpus at {1} = FIRE number'],
  [/^target − current (.+)$/, 'target − current {1}'],
  [/^tax limited to income above (.+)$/, 'tax limited to income above {1}'],
  [/^(\d+) × monthly expenses$/, '{1} × monthly expenses'],
  [/^(\d+)% of budget$/, '{1}% of budget'],
  [/^(\d+)% of (.+)$/, '{1}% of {2}'],
  [/^matched "(.+)"$/, 'matched "{1}"'],
  [/^(\d+) market scenarios \(equity σ (.+), debt σ (.+)\) at the required SIP$/, '{1} market scenarios (equity σ {2}, debt σ {3}) at the required SIP'],
  [/^Sec (\S+) \(formerly (.+)\)$/, 'Sec {1} (formerly {2})'],
  [/^on (.+)$/, 'on {1}'],
  // health score
  [/^([\d.]+) months of expenses covered; target is (\d+) months \((.+) short\)\.$/, '{1} months of expenses covered; target is {2} months ({3} short).'],
  [/^([\d.]+) months of expenses covered; target is (\d+) months\.$/, '{1} months of expenses covered; target is {2} months.'],
  [/^([\d.]+) months ÷ (\d+) months$/, '{1} months ÷ {2} months'],
  [/^([\d.]+) months$/, '{1} months'],
  [/^Life cover gap (.+)\.$/, 'Life cover gap {1}.'],
  [/^Health cover is (.+) below the (.+) baseline\.$/, 'Health cover is {1} below the {2} baseline.'],
  [/^equity (.+) vs target (.+)$/, 'equity {1} vs target {2}'],
  [/^(\d+)% equity vs an age-based target of (\d+)%\.$/, '{1}% equity vs an age-based target of {2}%.'],
  [/^EMI (.+) of income$/, 'EMI {1} of income'],
  [/^EMIs take (\d+)% of take-home pay \(lenders cap near (\d+)%\)\.$/, 'EMIs take {1}% of take-home pay (lenders cap near {2}%).'],
  [/^missed (.+)\/yr$/, 'missed {1}/yr'],
  [/^(.+) a year in unused deductions \(old regime\)\.$/, '{1} a year in unused deductions (old regime).'],
  [/^On track for (.+) of the (.+) needed at (\d+)\.$/, 'On track for {1} of the {2} needed at {3}.'],
  [/^Build a (\d+)-month emergency fund$/, 'Build a {1}-month emergency fund'],
  [/^Move toward (.+) equity$/, 'Move toward {1} equity'],
  [/^Bring EMIs under (\d+)% of income$/, 'Bring EMIs under {1}% of income'],
  [/^Strength: (.+)$/, 'Strength: {1}', true],
  [/^Improve (.+)$/, 'Improve {1}', true],
  [/^Add (.+) to a savings account or liquid fund\.$/, 'Add {1} to a savings account or liquid fund.'],
  [/^You could save (.+) a year by using Section 123 \(formerly 80C\), 80D and NPS in the old regime\.$/, 'You could save {1} a year by using Section 123 (formerly 80C), 80D and NPS in the old regime.'],
  [/^(.+) \(\+(.+)\/yr\)$/, '{1} (+{2}/yr)', true],
  [/^(.+) \((.+) gap\)$/, '{1} ({2} gap)', true],
  [/^(\d+)\/100 · (.+)$/, '{1}/100 · {2}', true],
  // FIRE
  [/^(\d+) years$/, '{1} years'],
  [/^(\d+)% Equity \/ (\d+)% Debt$/, '{1}% Equity / {2}% Debt'],
  [/^SIP of (.+)\/mo running; emergency fund complete$/, 'SIP of {1}/mo running; emergency fund complete'],
  [/^FIRE: corpus (.+) vs target (.+)$/, 'FIRE: corpus {1} vs target {2}'],
  [/^Rebalance to (.+)$/, 'Rebalance to {1}', true],
  [/^(\d+)× annual income$/, '{1}× annual income'],
  [/^(\d+) months of expenses$/, '{1} months of expenses'],
  [/^Employer NPS via salary restructuring \((\d+)% of basic\)$/, 'Employer NPS via salary restructuring ({1}% of basic)'],
  [/^Investing (.+) a month fits within your (.+) monthly surplus, putting FIRE at (\d+) within reach \((\d+)% of simulated markets\)\.$/, 'Investing {1} a month fits within your {2} monthly surplus, putting FIRE at {3} within reach ({4}% of simulated markets).'],
  [/^You need (.+) a month but have a (.+) surplus; retiring later, trimming expenses or raising the SIP each year closes the gap\.$/, 'You need {1} a month but have a {2} surplus; retiring later, trimming expenses or raising the SIP each year closes the gap.'],
  // life events
  [/^Your plan for: (.+)$/, 'Your plan for: {1}', true],
  [/^Bonus of (.+)$/, 'Bonus of {1}'],
  [/^Wedding budget of (.+)$/, 'Wedding budget of {1}'],
  [/^Inheritance of (.+)$/, 'Inheritance of {1}'],
  [/^New CTC of (.+)$/, 'New CTC of {1}'],
  [/^Home worth (.+)$/, 'Home worth {1}'],
  [/^Tax on the bonus is (.+) \((.+) of it\); (.+) stays in hand\.$/, 'Tax on the bonus is {1} ({2} of it); {3} stays in hand.'],
  [/^Sukanya Samriddhi deposits count under (.+) \(old regime\); a baby itself changes no tax\.$/, 'Sukanya Samriddhi deposits count under {1} (old regime); a baby itself changes no tax.'],
  [/^Tax on the new CTC is about (.+)\/yr; asking for employer NPS \((.+)\/yr\) cuts it by (.+)\.$/, 'Tax on the new CTC is about {1}/yr; asking for employer NPS ({2}/yr) cuts it by {3}.'],
  [/^Stamp duty and registration cost about (.+)\.$/, 'Stamp duty and registration cost about {1}.'],
  [/^In the old regime, (.+) interest saves (.+) in year one; the new regime gives no deduction for a self-occupied home\.$/, 'In the old regime, {1} interest saves {2} in year one; the new regime gives no deduction for a self-occupied home.'],
  [/^Investing (.+) now compounds to (.+) in 15 years at the equity assumption\.$/, 'Investing {1} now compounds to {2} in 15 years at the equity assumption.'],
  [/^Combining incomes can raise your savings rate; a (.+) wedding is about ([\d.]+) years of your income\.$/, 'Combining incomes can raise your savings rate; a {1} wedding is about {2} years of your income.'],
  [/^Education SIP of (.+)\/mo is needed alongside your FIRE plan\.$/, 'Education SIP of {1}/mo is needed alongside your FIRE plan.'],
  [/^(.+) invested today could reach (.+) in 15 years at 10%\.$/, '{1} invested today could reach {2} in 15 years at 10%.'],
  [/^Investing half of the (.+)\/mo raise keeps lifestyle creep in check\.$/, 'Investing half of the {1}/mo raise keeps lifestyle creep in check.'],
  [/^An EMI of (.+) for (\d+) years reduces what you can invest toward FIRE\.$/, 'An EMI of {1} for {2} years reduces what you can invest toward FIRE.'],
  [/^Brings the fund towards (\d+) months of expenses$/, 'Brings the fund towards {1} months of expenses'],
  [/^(.+) × (\d+)$/, '{1} × {2}'],
  [/^(.+)\/mo for 18 years$/, '{1}/mo for 18 years'],
  [/^Up to (.+)\/yr, government-backed$/, 'Up to {1}/yr, government-backed'],
  [/^Top up to (\d+) months first$/, 'Top up to {1} months first'],
  [/^(\d+) years of service$/, '{1} years of service'],
  [/^(\d+)% \(RBI caps the loan at (\d+)%\)$/, '{1}% (RBI caps the loan at {2}%)'],
  [/^(\d+)% of take-home$/, '{1}% of take-home'],
  [/^(\d+)% — long-term growth$/, '{1}% — long-term growth'],
  [/^(\d+)% — stability$/, '{1}% — stability'],
  [/^(\d+)% — diversification$/, '{1}% — diversification'],
  // history summaries (profile drawer)
  [/^FIRE number (.+) by (\d+); SIP (.+)\/mo$/, 'FIRE number {1} by {2}; SIP {3}/mo'],
  [/^Health score (\d+)\/100 \((.+)\); weakest: (.+)$/, 'Health score {1}/100 ({2}); weakest: {3}', true],
  [/^(.+): tax (.+), health (\d+)→(\d+)$/, '{1}: tax {2}, health {3}→{4}', true],
  [/^Household tax (.+) → (.+)$/, 'Household tax {1} → {2}'],
  [/^(\d+) funds, (.+), score (\d+)\/100$/, '{1} funds, {2}, score {3}/100'],
  [/^Scam check: (\w+) risk \((\d+) flags\)$/, 'Scam check: {1} risk ({2} flags)', true],
  [/^Asked: (.+)$/, 'Asked: {1}'],
  // couples moves
  [/^(.+) top-up for (.+)$/, '{1} top-up for {2}'],
  [/^NPS (.+) for (.+)$/, 'NPS {1} for {2}'],
  [/^Health cover (.+) for (.+)$/, 'Health cover {1} for {2}'],
  [/^Hold debt investments in (.+)'s name$/, "Hold debt investments in {1}'s name"],
  [/^Joint home loan (.+)$/, 'Joint home loan {1}'],
  [/^HRA claimed by (.+)$/, 'HRA claimed by {1}'],
  // portfolio
  [/^(\d+) funds in the same category usually hold many of the same stocks$/, '{1} funds in the same category usually hold many of the same stocks'],
  [/^Overlaps another (.+) fund$/, 'Overlaps another {1} fund', true],
  [/^Direct plan, TER ≈ (.+)$/, 'Direct plan, TER ≈ {1}'],
  [/^Regular plan: ≈(.+)\/yr extra$/, 'Regular plan: ≈{1}/yr extra'],
  [/^(.+) funds$/, '{1} funds', true],
  [/^Money-weighted return from (\d+) transactions$/, 'Money-weighted return from {1} transactions'],
  [/^Ahead of (.+) \(5-yr CAGR as of (.+)\)$/, 'Ahead of {1} (5-yr CAGR as of {2})'],
  [/^Behind (.+) \(5-yr CAGR as of (.+)\)$/, 'Behind {1} (5-yr CAGR as of {2})'],
  [/^(.+) → Direct plan$/, '{1} → Direct plan'],
  [/^(\d+) (.+) funds → 1$/, '{1} {2} funds → 1', true],
  [/^Same fund, lower TER: saves ≈(.+)\/yr\.$/, 'Same fund, lower TER: saves ≈{1}/yr.'],
  [/^Equity is (.+) vs your (.+) target — move the excess to short-duration debt or PPF\.$/, 'Equity is {1} vs your {2} target — move the excess to short-duration debt or PPF.'],
  [/^Equity is (.+) vs your (.+) target — add via a Nifty 50 index fund SIP\.$/, 'Equity is {1} vs your {2} target — add via a Nifty 50 index fund SIP.'],
  [/^One fund is (.+) of the portfolio; keep single funds under 35%\.$/, 'One fund is {1} of the portfolio; keep single funds under 35%.'],
  [/^Regular plans cost you about (.+) a year more than Direct plans\.$/, 'Regular plans cost you about {1} a year more than Direct plans.'],
  [/^(\d+) overlapping fund categories add little diversification\.$/, '{1} overlapping fund categories add little diversification.'],
  [/^Equity is (\d+) points above your target\.$/, 'Equity is {1} points above your target.'],
  [/^Equity is (\d+) points below your target\.$/, 'Equity is {1} points below your target.'],
  // scam shield
  [/^(.+) follows the format SEBI requires for registered brokers and mutual funds — still confirm it on SEBI Check$/, '{1} follows the format SEBI requires for registered brokers and mutual funds — still confirm it on SEBI Check'],
  [/^The message talks about investing, but (.+) is not an '@valid' handle used by SEBI-registered intermediaries$/, "The message talks about investing, but {1} is not an '@valid' handle used by SEBI-registered intermediaries"],
  [/^(.+) is an ordinary UPI ID — fine for people, but registered brokers and mutual funds collect money only via '@valid' handles$/, "{1} is an ordinary UPI ID — fine for people, but registered brokers and mutual funds collect money only via '@valid' handles"],
  [/^'(.+)' is not a valid UPI ID$/, "'{1}' is not a valid UPI ID"],
  [/^(.+) appears in the RBI directory snapshot\. Being listed is not an endorsement — RBI publishes what lenders report\.$/, '{1} appears in the RBI directory snapshot. Being listed is not an endorsement — RBI publishes what lenders report.'],
  [/^(.+) was not found in the RBI directory snapshot — treat it as unregulated until proven otherwise$/, '{1} was not found in the RBI directory snapshot — treat it as unregulated until proven otherwise'],
]

/**
 * Translates one backend string into `lang`. `translateGroups` patterns (marked `true`) also
 * translate their captured parts, e.g. a check label inside "Asking the model to fix: …".
 */
export function translatePhrase(text, lang) {
  if (lang === 'en' || typeof text !== 'string' || !text) return text
  const book = BOOKS[lang]
  if (!book) return text
  if (book[text] != null) return book[text]
  for (const [re, tpl, deep] of PATTERNS) {
    const m = text.match(re)
    if (!m || book[tpl] == null) continue
    return book[tpl].replace(/\{(\d)}/g, (_, i) => {
      const g = m[Number(i)] ?? ''
      return deep ? g.split(', ').map((part) => translatePhrase(part, lang)).join(', ') : g
    })
  }
  for (const sep of [' · ', SENTENCE]) {
    const parts = text.split(sep)
    if (parts.length < 2) continue
    const out = parts.map((part) => translatePhrase(part, lang))
    if (out.some((o, i) => o !== parts[i])) return out.join(sep === SENTENCE ? ' ' : sep)
  }
  return text
}
