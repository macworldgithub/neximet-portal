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
  ChevronDown,
  KeyRound,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      router.push('/dashboard');
    } else {
      setError(res.message || 'Invalid credentials. Please verify your email and password.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
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
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
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
                <label className="block text-xs font-semibold text-gray-300">
                  Password
                </label>
                <span className="text-[11px] text-gray-500">Encrypted</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-700 text-[#5470F4] focus:ring-0 bg-[#0B0F19]"
                />
                <span>Remember this terminal</span>
              </label>
              <span className="text-gray-500 hover:text-gray-400 text-[11px] cursor-pointer">
                Forgot password? Contact IT
              </span>
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

        {/* Discreet Test Directory Reference (Collapsible, Read-Only Reference) */}
        <details className="group bg-[#111827]/60 border border-[#1F293D] rounded-2xl p-3.5 text-xs transition-all">
          <summary className="cursor-pointer list-none flex items-center justify-between text-gray-400 hover:text-gray-300 select-none">
            <div className="flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-[#5CC5FA]" />
              <span className="font-semibold text-[11px]">System Credentials Directory (For Testing)</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-3 pt-3 border-t border-[#1F293D] space-y-2.5 text-[11px]">
            <p className="text-gray-400 text-[10px] leading-relaxed">
              Login credentials determine user role and permissions automatically upon sign-in. Default password for all seeded accounts is <code className="text-[#5CC5FA] bg-[#0B0F19] px-1.5 py-0.5 rounded border border-[#1F293D]">password123</code>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
              <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1F293D]">
                <span className="text-amber-400 font-bold block">CEO (Full Superadmin)</span>
                <span className="text-gray-300">ceo@neximet.com</span>
              </div>
              <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1F293D]">
                <span className="text-blue-400 font-bold block">Project Manager</span>
                <span className="text-gray-300">pm@neximet.com</span>
              </div>
              <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1F293D]">
                <span className="text-purple-400 font-bold block">Team Manager (WordPress)</span>
                <span className="text-gray-300">tariq.wp@neximet.com</span>
              </div>
              <div className="p-2 rounded-xl bg-[#0B0F19] border border-[#1F293D]">
                <span className="text-emerald-400 font-bold block">Team Member (Software Dev)</span>
                <span className="text-gray-300">bilal.dev@neximet.com</span>
              </div>
            </div>
          </div>
        </details>

        {/* Global Security & Copyright Footer */}
        <div className="text-center text-[11px] text-gray-500 space-y-1">
          <p>Neximet Platform • All financial metrics & salary deductions managed in PKR</p>
          <p>
            Official Website:{' '}
            <a
              href="https://neximet.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5CC5FA] hover:underline"
            >
              neximet.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
