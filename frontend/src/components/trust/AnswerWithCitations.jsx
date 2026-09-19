import ReactMarkdown from 'react-markdown'

/**
 * Markdown answer where [S1]-style markers become superscript links to the cited official page.
 * While streaming, a caret shows the text is still arriving.
 */
export default function AnswerWithCitations({ text, citations = [], streaming = false, lang }) {
  const byId = Object.fromEntries(citations.map((c) => [c.id, c]))
  const md = (text || '').replace(/\[S(\d+)]/g, (m, n) => (byId[`S${n}`] ? `[S${n}](#cite-S${n})` : ''))

  return (
    <div lang={lang} aria-live={streaming ? 'polite' : undefined} className="prose prose-sm max-w-none text-navy-900/80 leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:text-navy-900">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('#cite-')) {
              const c = byId[href.slice(6)]
              return (
                <sup>
                  <a
                    href={c?.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    title={c ? `${c.authority} — ${c.title}` : undefined}
                    className="no-underline text-[10px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                  >
                    {children}
                  </a>
                </sup>
              )
            }
            return <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">{children}</a>
          },
        }}
      >
        {md}
      </ReactMarkdown>
      {streaming && <span className="inline-block w-1.5 h-4 bg-navy-900/60 align-middle animate-pulse ml-0.5" />}
    </div>
  )
}
