import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import HistoryPage from './pages/HistoryPage'
import Integrations from './pages/Integrations'
import Settings from './pages/Settings'
import Docs from './pages/Docs'
import Changelog from './pages/Changelog'
import ForgotPassword from './pages/ForgotPassword'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import Support from './pages/Support'
import ProtectedRoute from './components/ProtectedRoute'
import { Shield } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import BrandLogo from './components/BrandLogo'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-navy-900 text-surface-200 flex flex-col">
            <Navbar />

            {/* Main Content Area */}
            <main className="flex-1 pt-20">
              <Routes>
                <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/docs" element={<ProtectedRoute><Docs /></ProtectedRoute>} />
                <Route path="/changelog" element={<ProtectedRoute><Changelog /></ProtectedRoute>} />
                <Route path="/privacy" element={<ProtectedRoute><PrivacyPolicy /></ProtectedRoute>} />
                <Route path="/terms" element={<ProtectedRoute><TermsOfService /></ProtectedRoute>} />
                <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Routes>
            </main>

            {/* Global Footer */}
            <footer className="py-8 px-4 border-t border-brand-500/10 mt-auto">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-surface-500">
                  <BrandLogo className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    © 2026 SecAudit. All rights reserved.
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <Link to="/privacy" className="text-sm text-surface-500 hover:text-white transition-colors duration-200">
                    Privacy
                  </Link>
                  <Link to="/terms" className="text-sm text-surface-500 hover:text-white transition-colors duration-200">
                    Terms
                  </Link>
                  <Link to="/support" className="text-sm text-surface-500 hover:text-white transition-colors duration-200">
                    Support
                  </Link>
                  <Link to="/docs" className="text-sm text-surface-500 hover:text-white transition-colors duration-200">
                    Docs
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}
