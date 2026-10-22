'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Coins,
  Building2,
  KeyRound,
} from 'lucide-react';
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your corporate email and password.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await login(email.trim(), password);
    if (res.success) {
      const chat = new URLSearchParams(window.location.search).get('chat');
      const meeting = new URLSearchParams(window.location.search).get('meet');
      const meetingParams = new URLSearchParams(meeting || '');
      const meetingChat = meetingParams.get('conversation');
      const next = new URLSearchParams(window.location.search).get('next');
      let nextUrl: URL | null = null;
      try { if (next) nextUrl = new URL(next, window.location.origin); } catch { /* Invalid return paths use the dashboard. */ }
      const announcementRoute = nextUrl?.origin === window.location.origin && ['/announcements', '/notifications'].includes(nextUrl.pathname) ? nextUrl.pathname + nextUrl.search : null;
      router.push(announcementRoute || (meetingChat && /^[a-f\d]{24}$/i.test(meetingChat) ? `/meet?${meetingParams.toString()}` : chat && /^[a-f\d]{24}$/i.test(chat) ? `/chat?conversation=${chat}` : '/dashboard'));
    } else {
      setError(res.message || 'Invalid credentials. Please verify your email and password.');
    }
    setLoading(false);
  };

  return (
    <div className="portal-auth min-h-screen bg-[#0B0F19] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Dynamic ambient backdrop lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#5470F4]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/3 w-[400px] h-[400px] bg-[#5CC5FA]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full z-10 space-y-6">
        {/* Brand & Corporate Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img
              src="/neximet-logo.avif"
              alt="Neximet"
              className="h-10 w-auto object-contain drop-shadow-md"
              onError={(e) => {
                // Fallback badge if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <div className="inline-flex items-center gap-2 bg-[#161F30] border border-[#5470F4]/30 px-3.5 py-1 rounded-full shadow-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-[#5CC5FA]" />
            <span className="text-[11px] font-semibold text-[#5CC5FA] uppercase tracking-wider">
              Neximet Corporate Platform
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Employee & Operations Portal
          </h1>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            Software Development • Digital Marketing (SEO) • Graphics Designing • WordPress Team
          </p>

          <div className="inline-flex items-center gap-2 bg-[#111827] border border-[#1F293D] px-3 py-1 rounded-full text-[11px] text-gray-400">
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            <span>All Salaries, Daily Wages & Deductions in <strong>Pakistani Rupee (PKR)</strong></span>
          </div>
        </div>

        {/* Primary Enterprise Authentication Card */}
        <div className="bg-[#111827]/95 backdrop-blur-2xl border border-[#1F293D] rounded-3xl p-7 sm:p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#5470F4]" />
              <span>Sign In with Credentials</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Enter your corporate email and password to securely access your portal dashboard.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-gray-300 mb-1.5">
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@neximet.com"
                  autoComplete="email"
                  autoFocus
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold text-gray-300">
                  Password
                </label>
                <span className="text-[11px] text-gray-500">Encrypted</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-700 text-[#5470F4] focus:ring-0 bg-[#0B0F19]"
                />
                <span>Remember this terminal</span>
              </label>
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-[#5CC5FA] hover:text-[#7BCFFF] hover:underline text-[11px] cursor-pointer transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-xs font-bold text-white gradient-btn flex items-center justify-center gap-2 shadow-lg shadow-[#5470F4]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Verifying Credentials...' : 'Sign In to Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Security Guarantee Note */}
          <div className="pt-3 border-t border-[#1F293D] flex items-center justify-between text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-[#5CC5FA]" />
              <span>Neximet Private Enterprise</span>
            </span>
            <span>256-Bit SSL Protected</span>
          </div>
        </div>

        {/* Global Security & Copyright Footer */}
        <div className="text-center text-[11px] text-gray-500 space-y-1">
          <p>Neximet Platform • All financial metrics & salary deductions managed in PKR</p>
          <p>
            Official Website:{' '}
            <a
              href="https://neximet.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[#5CC5FA] hover:underline"
            >
              neximet.com
            </a>
          </p>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        initialEmail={email}
      />
    </div>
  );
}
