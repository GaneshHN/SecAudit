import { ShieldCheck, Eye, Lock, RefreshCw, FileText, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export default function PrivacyPolicy() {
  const [activeTab, setActiveTab] = useState('collection')

  const sections = [
    {
      id: 'collection',
      title: 'Information We Collect',
      icon: Eye,
      content: `At SecAudit, we collect only the necessary data to perform automated security scans on your repositories, codebases, and website URLs:
      
      • Repository and Archive Code: When you upload a project ZIP or provide a repository URL, our scanning engine accesses the file structure and source code files to parse against our security rules.
      • URL Audits: If you submit a website URL, we crawl the public assets to analyze HTTP headers, configuration settings, and SSL certificate details.
      • Account Profile Data: If you create an account, we store your profile details including your name, email, role, and avatar. All passwords are encrypted securely.
      • Scan History: We retain a record of your scan results, including severity counts, security scores, and list of identified vulnerabilities, to populate your user history dashboard.`
    },
    {
      id: 'processing',
      title: 'How We Process Data',
      icon: RefreshCw,
      content: `Your code and repositories are processed with surgical precision and under tight security controls:
      
      • Ephemeral Scan Storage: Uploaded project files are extracted into write-only, isolated temp directories on the server.
      • Instant Cleanup: As soon as a scan finishes or times out, the backend triggers an automatic cleanup process, permanently unlinking and deleting all temporary directories and extracted files from the disk.
      • No Code Retention: We do NOT copy, store, or archive your intellectual property or source code. Once the scan is complete, your code is gone from our environment. Only the metadata (vulnerabilities list and scores) is stored in the history database.`
    },
    {
      id: 'security',
      title: 'Data Security & Retention',
      icon: Lock,
      content: `We implement robust security measures to protect your information:
      
      • Encryption in Transit: All data transferred between your browser and our servers is encrypted using industry-standard TLS.
      • Session Management: User sessions are managed with JWT authentication tokens.
      • File Filtering: We pre-screen files to ignore binary payloads, preventing execution of uploaded payloads and minimizing security risks.
      • History Control: You have complete ownership and control over your history data. At any time, you can delete specific scan logs or clear your scan history via the Dashboard page.`
    }
  ]

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 animate-fade-in-down">
        <div className="flex items-center justify-center w-12 h-12 bg-brand-500/10 rounded-xl border border-brand-500/20 text-brand-400">
          <ShieldCheck className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-surface-400 text-sm">Last updated: May 2026. Learn how we handle your repositories and audit records.</p>
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
                <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'translate-x-0.5 text-brand-400' : 'opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5'}`} />
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

      {/* Footer warning */}
      <div className="mt-8 p-5 rounded-2xl bg-surface-800/20 border border-surface-800/50 text-xs text-surface-400 leading-relaxed flex items-start gap-3">
        <FileText className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
        <p>
          By connecting your repositories or scanning assets through the SecAudit Vulnerability Scanner, you agree that you possess the necessary authorization to scan these files. If you have questions regarding our security protocols, please reach out via our 
          <a href="/support" className="text-brand-400 hover:text-brand-300 font-semibold underline mx-1">Support & Help page</a>.
        </p>
      </div>
    </div>
  )
}
