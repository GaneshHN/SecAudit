import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, ArrowLeft, Key, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

// Same simple hash function as AuthContext.jsx
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return hash.toString(36)
}

function getAccounts() {
  try {
    const accounts = localStorage.getItem('secAuditAccounts')
    return accounts ? JSON.parse(accounts) : {}
  } catch {
    return {}
  }
}

function saveAccounts(accounts) {
  localStorage.setItem('secAuditAccounts', JSON.stringify(accounts))
}

export default function ForgotPassword() {
  const [step, setStep] = useState(1) // 1 = request email, 2 = verify code, 3 = reset password, 4 = success
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleRequestCode = (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    
    const accounts = getAccounts()
    const emailKey = email.trim().toLowerCase()
    
    if (!accounts[emailKey]) {
      setError('No account found with this email address. Please sign up instead.')
      return
    }

    // Account exists - move to verification step
    setStep(2)
    setInfo(`For demonstration, use verification code: 123456`)
  }

  const handleVerifyCode = (e) => {
    e.preventDefault()
    setError('')
    
    if (code.trim() === '123456') {
      setStep(3)
      setInfo('')
    } else {
      setError('Incorrect verification code. (Hint: Code is 123456).')
    }
  }

  const handleResetPassword = (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const accounts = getAccounts()
    const emailKey = email.trim().toLowerCase()

    if (accounts[emailKey]) {
      accounts[emailKey].passwordHash = simpleHash(newPassword)
      saveAccounts(accounts)
      setStep(4)
    } else {
      setError('An error occurred. Please restart the process.')
      setStep(1)
    }
  }

  return (
    <div className="min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-brand-500/10 rounded-full blur-[150px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 mb-5 shadow-lg shadow-brand-500/10">
            <BrandLogo className="w-9 h-9" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">Reset Password</h2>
          <p className="text-surface-400 text-sm">Recover access to your SecAudit account.</p>
        </div>

        <div className="glass-card p-8">
          {/* Error Banner */}
          {error && (
            <div className="mb-5 flex items-start gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 animate-fade-in-up">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 font-medium">{error}</p>
            </div>
          )}

          {/* Info Banner */}
          {info && (
            <div className="mb-5 flex items-start gap-3 p-3.5 rounded-lg bg-brand-500/10 border border-brand-500/30 animate-fade-in-up">
              <Key className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-brand-300 font-medium">{info}</p>
            </div>
          )}

          {/* ════════════ STEP 1: EMAIL REQUEST ════════════ */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    className="w-full pl-10 pr-4 py-2.5 bg-navy-900/50 border border-surface-700 rounded-lg text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors"
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all duration-200"
              >
                Send Reset Code
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <div className="text-center">
                <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-surface-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Link>
              </div>
            </form>
          )}

          {/* ════════════ STEP 2: CODE VERIFICATION ════════════ */}
          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <div className="mb-4">
                  <p className="text-xs text-surface-400">
                    We sent a verification code to <span className="text-white font-semibold">{email}</span>.
                  </p>
                </div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Verification Code</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-500">
                    <Key className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError('') }}
                    className="w-full pl-10 pr-4 py-2.5 bg-navy-900/50 border border-surface-700 rounded-lg text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors tracking-[0.2em] font-mono text-center text-lg"
                    placeholder="123456"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white rounded-lg text-sm font-bold shadow-lg"
              >
                Verify Code
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setStep(1); setCode(''); setError(''); setInfo(''); }}
                  className="flex items-center justify-center gap-2 text-sm font-medium text-surface-400 hover:text-white mx-auto transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Change email
                </button>
              </div>
            </form>
          )}

          {/* ════════════ STEP 3: RESET PASSWORD ════════════ */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError('') }}
                    className="w-full pl-10 pr-10 py-2.5 bg-navy-900/50 border border-surface-700 rounded-lg text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-500 hover:text-surface-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                    className="w-full pl-10 pr-4 py-2.5 bg-navy-900/50 border border-surface-700 rounded-lg text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white rounded-lg text-sm font-bold shadow-lg"
              >
                Reset Password
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ════════════ STEP 4: SUCCESS ════════════ */}
          {step === 4 && (
            <div className="text-center animate-fade-in-up">
              <div className="mb-4 text-emerald-400">
                <CheckCircle2 className="w-12 h-12 mx-auto animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Password Reset Successful</h3>
              <p className="text-surface-400 text-sm mb-6">
                Your password has been successfully updated. You can now log in using your new credentials.
              </p>
              <Link to="/login" className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg text-sm font-bold shadow-lg hover:from-brand-400 hover:to-brand-500 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Proceed to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
