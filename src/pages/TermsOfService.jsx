import { BookOpen, Scale, AlertTriangle, Shield, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

export default function TermsOfService() {
  const [activeTab, setActiveTab] = useState('license')

  const sections = [
    {
      id: 'license',
      title: 'Usage License & Scope',
      icon: Shield,
      content: `Welcome to SecAudit. By using our automated platform, you are granted a revocable, non-exclusive license to scan software projects and websites:
      
      • Intended Use: You may use SecAudit to check for security vulnerabilities, secrets leakage, open-source compliance issues, and general configuration issues in projects you own or have explicit authorization to audit.
      • Restrictions: You may NOT use SecAudit to perform malicious vulnerability scans, initiate denial of service (DoS) attacks, scrape intellectual properties, or crawl systems without consent.
      • Single Account Policy: User accounts are personal and cannot be shared or automated via headless bots outside standard API integrations.`
    },
    {
      id: 'liability',
      title: 'Limitation of Liability',
      icon: Scale,
      content: `SecAudit is a static and dynamic code auditing assistant designed to identify common security risks. 
      
      • Disclaimer of Warranty: SecAudit is provided "AS IS" without warranty of any kind. Automated scans do not guarantee 100% security coverage, nor do they replace professional security architecture reviews or manual audits.
      • Liability Limitation: Under no circumstances shall SecAudit or its maintainers be liable for any direct, indirect, incidental, or consequential damages resulting from data loss, server downtime, production breaches, or missed security vulnerabilities.`
    },
    {
      id: 'compliance',
      title: 'Compliance & Acceptable Use',
      icon: AlertTriangle,
      content: `Users must abide by industry regulations and legal requirements:
      
      • Fair Use Limits: To ensure platform stability, upload files are limited to 500MB, and scanning executions are subject to rate limiting and timeouts (e.g. serverless execution limits).
      • Data Compliance: You are responsible for ensuring that scanned repositories do not contain strictly regulated records, child-endangering contents, or stolen credentials that you do not own.
      • Policy Updates: We reserve the right to modify these terms. Continued usage of SecAudit after changes constitutes acceptance.`
    }
  ]

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 animate-fade-in-down">
        <div className="flex items-center justify-center w-12 h-12 bg-brand-500/10 rounded-xl border border-brand-500/20 text-brand-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Terms of Service</h1>
          <p className="text-surface-400 text-sm">Last updated: May 2026. Rules and guidelines for using the SecAudit platform.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-6 animate-fade-in-up">
        {/* Navigation Sidebar */}
        <div className="md:col-span-4 space-y-2">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = activeTab === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${
                  isActive
                    ? 'bg-brand-500/10 border-brand-500/30 text-white shadow-lg'
                    : 'bg-navy-950/20 border-surface-800/30 text-surface-400 hover:bg-white/[0.02] hover:border-surface-700/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-brand-500/20 text-brand-400' : 'bg-surface-800/50 text-surface-500 group-hover:text-surface-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">{section.title}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Content Display */}
        <div className="md:col-span-8">
          <div className="glass-card p-6 sm:p-8 min-h-[300px] flex flex-col">
            {sections.map((section) => {
              if (section.id !== activeTab) return null
              const Icon = section.icon
              return (
                <div key={section.id} className="animate-fade-in-up flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-surface-800/50">
                    <Icon className="w-5 h-5 text-brand-400" />
                    <h2 className="text-xl font-bold text-white">{section.title}</h2>
                  </div>
                  <div className="text-sm text-surface-300 leading-relaxed whitespace-pre-line flex-1">
                    {section.content}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Acceptable confirmation */}
      <div className="mt-8 p-5 rounded-2xl bg-surface-800/20 border border-surface-800/50 text-xs text-surface-400 leading-relaxed flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
        <p>
          By creating an account, running tests, or initiating scans, you confirm that you have read, understood, and agreed to be bound by these Terms of Service. If you violate any terms, we reserve the right to suspend your access immediately.
        </p>
      </div>
    </div>
  )
}
