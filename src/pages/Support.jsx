import { HelpCircle, Mail, MessageSquare, Activity, Send, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export default function Support() {
  const [faqs, setFaqs] = useState([
    {
      q: 'How does the automated file upload scan work?',
      a: 'When you upload a ZIP archive, our backend extracts it to an ephemeral temp directory, recursively crawls it to skip binary files, and checks the remaining source code against pre-configured rules. The extracted files are instantly deleted as soon as the scan finishes.',
      open: true
    },
    {
      q: 'Why did my scan fail with a timeout?',
      a: 'Vercel Serverless Functions have a maximum runtime timeout of 10 seconds on Hobby plans. For very large codebases, our engine automatically caps the scan duration at 8 seconds and returns a partial set of issues to prevent crashing. To scan larger projects, split them into smaller folders or run SecAudit locally.',
      open: false
    },
    {
      q: 'Can I integrate SecAudit into GitHub Actions?',
      a: 'Yes! Navigate to the Integrations page in the sidebar where you will find copy-pasteable YAML configurations to run SecAudit gates in your GitHub or GitLab CI/CD pipelines.',
      open: false
    },
    {
      q: 'Is my source code stored or sent to any AI third-party?',
      a: 'No. The scanner runs purely locally on Node/Python engines. We do not store your source code, and no code contents are uploaded to cloud servers or AI engines without explicit API configuration.',
      open: false
    }
  ])

  const [ticket, setTicket] = useState({ name: '', email: '', category: 'General Inquiry', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const toggleFaq = (index) => {
    setFaqs(faqs.map((f, i) => i === index ? { ...f, open: !f.open } : f))
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setTicket(t => ({ ...t, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
    }, 1000)
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 animate-fade-in-down">
        <div className="flex items-center justify-center w-12 h-12 bg-brand-500/10 rounded-xl border border-brand-500/20 text-brand-400">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Support & Help Center</h1>
          <p className="text-surface-400 text-sm">Need help? Browse our knowledge base or submit a support ticket.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 animate-fade-in-up">
        {/* Left column: FAQ and Contacts */}
        <div className="lg:col-span-7 space-y-6">
          {/* FAQ Accordion */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-brand-400" />
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div 
                  key={idx} 
                  className="rounded-xl border border-surface-800/40 bg-navy-950/20 overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-4 text-left font-semibold text-sm text-white hover:bg-white/[0.02] transition-colors"
                  >
                    <span>{faq.q}</span>
                    {faq.open ? <ChevronUp className="w-4 h-4 text-brand-400" /> : <ChevronDown className="w-4 h-4 text-surface-500" />}
                  </button>
                  {faq.open && (
                    <div className="px-4 pb-4 text-xs text-surface-400 leading-relaxed border-t border-surface-800/20 pt-3 bg-navy-900/20">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Channels & Status */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="glass-card p-4 text-center">
              <Mail className="w-6 h-6 mx-auto mb-2 text-brand-400" />
              <h3 className="text-sm font-bold text-white">Email Support</h3>
              <p className="text-[10px] text-surface-500 mt-1">support@secaudit.io</p>
            </div>
            <div className="glass-card p-4 text-center">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 text-brand-400" />
              <h3 className="text-sm font-bold text-white">Discord Guild</h3>
              <p className="text-[10px] text-surface-500 mt-1">Join the community</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Activity className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Platform Status</h3>
              <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Ticket Form */}
        <div className="lg:col-span-5">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Send className="w-4 h-4 text-brand-400" />
              Submit a Ticket
            </h2>
            <p className="text-xs text-surface-500 mb-6">Can't find what you need? Send a message and our team will get back to you within 24 hours.</p>
            
            {submitted ? (
              <div className="text-center py-8 animate-fade-in-up">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Ticket Submitted!</h3>
                <p className="text-xs text-surface-400 mb-6">Thank you for reaching out. We have logged your request and sent a confirmation email.</p>
                <button
                  onClick={() => { setSubmitted(false); setTicket({ name: '', email: '', category: 'General Inquiry', subject: '', message: '' }) }}
                  className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-xs text-white rounded-lg transition-colors font-semibold"
                >
                  Submit another ticket
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">Your Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={ticket.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-navy-900/50 border border-surface-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={ticket.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-navy-900/50 border border-surface-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">Topic Category</label>
                  <select
                    name="category"
                    value={ticket.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-navy-900/90 border border-surface-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 cursor-pointer"
                  >
                    <option>General Inquiry</option>
                    <option>Scan Failures / Errors</option>
                    <option>API & CLI Integrations</option>
                    <option>Billing & Enterprise Plans</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">Subject</label>
                  <input
                    type="text"
                    name="subject"
                    required
                    value={ticket.subject}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-navy-900/50 border border-surface-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    placeholder="Brief summary of the issue"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">Description</label>
                  <textarea
                    name="message"
                    required
                    rows={4}
                    value={ticket.message}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-navy-900/50 border border-surface-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                    placeholder="Provide details about your query or instructions to reproduce scan errors..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white rounded-lg text-xs font-bold transition-all duration-200"
                >
                  {submitting ? 'Sending Request...' : 'Send Message'}
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
