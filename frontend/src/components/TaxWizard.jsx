import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, FileText, Edit3, User, Sparkles, UploadCloud, Image as ImageIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export default function TaxWizard() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your ET Tax Wizard. Need help deciding between the Old and New tax regimes, or looking for missing deductions? How can I help you save some money today?"
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (messageObject = null) => {
    if (!messageObject && !inputValue.trim()) return

    const newMsg = messageObject || { role: 'user', text: inputValue }
    const newMessages = [...messages, newMsg]

    setMessages(newMessages)
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/tax/wizard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ history: newMessages })
      })

      const data = await response.json()

      if (response.ok && data.response) {
        setMessages([...newMessages, { role: 'assistant', text: data.response }])
      } else {
        const errorMsg = data.error || "Hmm, I encountered an issue connecting to my brain. Make sure the backend is running and your API key is valid."
        if (errorMsg.includes("429") || errorMsg.includes("quota")) {
          setMessages([...newMessages, { role: 'assistant', text: "I've hit the Google Gemini API rate limit for the free tier! Please wait about 30 seconds before asking another question." }])
        } else {
          setMessages([...newMessages, { role: 'assistant', text: "Error: " + errorMsg }])
        }
      }
    } catch (error) {
      console.error(error)
      setMessages([...newMessages, { role: 'assistant', text: "Oops, I couldn't reach the backend server. Make sure your Spring Boot app is running on port 8080." }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const pasteManualTemplate = () => {
    setInputValue("Here are my details for FY 24-25:\n- Gross Salary: ₹\n- 80C Investments (PPF, ELSS, etc.): ₹\n- HRA (Annual Rent Paid): ₹\n- Home Loan Interest: ₹\n- NPS (80CCD): ₹\n- Medical Insurance (80D): ₹")
  }

  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      alert('Please upload a valid PDF or Image file.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64String = reader.result.split(',')[1]
      const newMsg = {
        role: 'user',
        text: `I have attached my document: ${file.name}.`,
        inlineData: {
          mimeType: file.type,
          data: base64String
        },
        fileName: file.name
      }
      handleSend(newMsg)
    }
    reader.readAsDataURL(file)
  }

  return (
    <section id="tax" className="py-24 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-10">
          <div className="section-tag mx-auto mb-4">
            <Sparkles size={11} />
            AI Chatbot
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-navy-900 mb-4">
            Meet the <span className="gradient-text">Tax Wizard</span>
          </h2>
          <p className="text-navy-900/55 text-lg">
            An expert advisor embedded with Economic Times intelligence to optimize your salary structure.
          </p>
        </div>

        {/* Chat Window */}
        <div className="glass-card border border-navy-900/10 rounded-2xl overflow-hidden flex flex-col h-[600px] shadow-lg">
          {/* Header */}
          <div className="bg-navy-900/[0.03] border-b border-navy-900/[0.08] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-navy-900/[0.08] flex items-center justify-center border border-navy-900/10">
                <Sparkles size={20} className="text-navy-900/60" />
              </div>
              <div>
                <h3 className="text-navy-900 font-bold text-sm">ET Tax Wizard</h3>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online
                </p>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-cream/50">
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 border ${msg.role === 'user' ? 'bg-navy-900/[0.06] border-navy-900/10' : 'bg-navy-900/[0.06] border-navy-900/10'}`}>
                    {msg.role === 'user' ? <User size={14} className="text-navy-900/60" /> : <Sparkles size={14} className="text-navy-900/60" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                      ? 'bg-navy-900 text-white rounded-tr-none'
                      : 'bg-white text-navy-900/80 border border-navy-900/[0.08] rounded-tl-none prose prose-sm max-w-none'
                    }`}>
                    {msg.role === 'user' ? (
                      <div>
                        {msg.text}
                        {msg.inlineData && (
                          <div className="mt-3 flex items-center gap-2 bg-white/20 px-3 py-2 rounded-lg border border-white/30 text-xs w-fit">
                            {msg.inlineData.mimeType.startsWith('image/') ? (
                              <img src={`data:${msg.inlineData.mimeType};base64,${msg.inlineData.data}`} alt="upload" className="w-12 h-12 object-cover rounded shadow-sm" />
                            ) : (
                              <FileText size={14} />
                            )}
                            <span className="truncate max-w-[200px] font-medium">{msg.fileName || 'Document'}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 max-w-[85%]"
                >
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 bg-navy-900/[0.06] border border-navy-900/10">
                    <Sparkles size={14} className="text-navy-900/60" />
                  </div>
                  <div className="p-4 rounded-2xl bg-white text-navy-900/40 border border-navy-900/[0.08] flex items-center gap-2 rounded-tl-none">
                    <span className="w-2 h-2 bg-navy-900/30 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-navy-900/30 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-navy-900/30 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions & Input Area */}
          <div className="p-4 bg-white border-t border-navy-900/[0.08]">
            {messages.length === 1 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                <button onClick={pasteManualTemplate} className="flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full border border-navy-900/15 bg-navy-900/[0.04] text-navy-900/60 text-xs hover:bg-navy-900/[0.08] transition-colors">
                  <Edit3 size={12} /> Enter Details Manually
                </button>
                <button onClick={triggerFileUpload} className="flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full border border-navy-900/15 bg-navy-900/[0.04] text-navy-900/60 text-xs hover:bg-navy-900/[0.08] transition-colors">
                  <UploadCloud size={12} /> Upload File / Photo
                </button>
              </div>
            )}

            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />

            <div className="relative flex items-end">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your tax question here..."
                className="w-full bg-navy-900/[0.03] border border-navy-900/10 rounded-xl px-4 py-3 pr-12 text-sm text-navy-900 placeholder-navy-900/30 focus:outline-none focus:border-navy-900/30 focus:ring-1 focus:ring-navy-900/20 resize-none max-h-32 min-h-[50px] transition-all"
                rows={inputValue.split('\n').length > 1 ? Math.min(6, inputValue.split('\n').length) : 1}
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50 disabled:hover:bg-navy-900 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-navy-900/35 text-center mt-3">
              * The Wizard calculates based on FY 2024-25 standards. Consult a certified CA for final filings.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
