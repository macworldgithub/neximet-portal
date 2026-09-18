'use client';

import React, { useState } from 'react';
import { apiPost } from '../../lib/api';
import {
  X,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Coins,
  Phone,
  Calendar,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (user: any) => void;
}

export default function CreateEmployeeModal({
  isOpen,
  onClose,
  onCreated,
}: CreateEmployeeModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('Team Member');
  const [department, setDepartment] = useState('Software Development');
  const [designation, setDesignation] = useState('');
  const [baseSalary, setBaseSalary] = useState(150000);
  const [dailyWage, setDailyWage] = useState(5000);
  const [phone, setPhone] = useState('+92 (300) 123-4567');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [casualLeaves, setCasualLeaves] = useState(10);
  const [sickLeaves, setSickLeaves] = useState(8);
  const [annualLeaves, setAnnualLeaves] = useState(14);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let res = 'Nx#';
    for (let i = 0; i < 7; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
  };

  const handleSalaryChange = (val: number) => {
    setBaseSalary(val);
    setDailyWage(Math.round(val / 30));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password || !department) {
      setError('Please fill in all mandatory fields (Name, Corporate Email, Password, Department).');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        department,
        designation: designation.trim() || 'Specialist',
        baseSalary: Number(baseSalary) || 120000,
        dailyWage: Number(dailyWage) || Math.round((Number(baseSalary) || 120000) / 30),
        phone: phone.trim(),
        joinDate,
        leaveBalances: {
          casual: Number(casualLeaves),
          sick: Number(sickLeaves),
          annual: Number(annualLeaves),
        },
      };

      const res = await apiPost('/auth/users', payload);

      if (res.success) {
        setCreatedEmployee({
          ...res.user,
          plainPassword: password,
        });
        onCreated(res.user);
      } else {
        setError(res.message || 'Failed to create employee.');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error while creating employee.');
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!createdEmployee) return;
    const text = `Neximet Corporate Portal - Account Credentials\nName: ${createdEmployee.name}\nRole: ${createdEmployee.role}\nDepartment: ${createdEmployee.department}\nCorporate Email: ${createdEmployee.email}\nTemporary Password: ${createdEmployee.plainPassword}\nLogin URL: ${window.location.origin}/login\n\nPlease sign in and change your password upon initial access.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setPassword('');
    setCreatedEmployee(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-[#1F293D] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1F293D] flex items-center justify-between bg-[#0E1424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5470F4]/20 to-[#5CC5FA]/20 border border-[#5470F4]/40 flex items-center justify-center text-[#5CC5FA]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create New Employee</h3>
              <p className="text-xs text-gray-400">Add personnel to the Neximet organizational roster</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {createdEmployee ? (
            /* Success State */
            <div className="py-6 space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white">Employee Account Created!</h4>
                <p className="text-xs text-gray-400 mt-1">
                  The account has been provisioned and is active in the organizational database.
                </p>
              </div>

              <div className="bg-[#0B0F19] border border-[#1F293D] rounded-2xl p-5 text-left space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-[#1F293D] pb-2">
                  <span className="text-gray-400">Full Name:</span>
                  <span className="text-white font-bold">{createdEmployee.name}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F293D] pb-2">
                  <span className="text-gray-400">Corporate Email:</span>
                  <span className="text-[#5CC5FA]">{createdEmployee.email}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F293D] pb-2">
                  <span className="text-gray-400">Temporary Password:</span>
                  <span className="text-amber-400 font-bold">{createdEmployee.plainPassword}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F293D] pb-2">
                  <span className="text-gray-400">Role & Department:</span>
                  <span className="text-gray-200">{createdEmployee.role} • {createdEmployee.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Base Salary (PKR):</span>
                  <span className="text-emerald-400 font-bold">PKR {Number(createdEmployee.baseSalary).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={copyCredentials}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#1F293D] hover:bg-[#2A3752] border border-[#5470F4]/40 flex items-center justify-center gap-2 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#5CC5FA]" />}
                  <span>{copied ? 'Credentials Copied to Clipboard!' : 'Copy Credentials for Employee'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-3 px-6 rounded-xl text-xs font-bold text-white gradient-btn shadow-lg shadow-[#5470F4]/20 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section 1: Basic & Authentication */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#5CC5FA] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Profile & Security Credentials</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Hamza Tariq"
                      required
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Corporate Email *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. hamza.dev@neximet.com"
                        required
                        className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300">
                      Initial Password *
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] text-[#5CC5FA] hover:text-[#7BCFFF] flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Auto-Generate</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter minimum 6 characters or auto-generate"
                      required
                      minLength={6}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Role & Department */}
              <div className="space-y-4 pt-2 border-t border-[#1F293D]">
                <h4 className="text-xs font-bold text-[#5CC5FA] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Organizational Assignment</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      System Role *
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                    >
                      <option value="Team Member">Team Member</option>
                      <option value="Team Manager">Team Manager</option>
                      <option value="Project Manager">Project Manager</option>
                      <option value="Super Admin">Super Admin</option>
                      <option value="CEO">CEO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Department *
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                    >
                      <option value="Software Development">Software Development</option>
                      <option value="Digital Marketing (SEO)">Digital Marketing (SEO)</option>
                      <option value="Graphics Designing">Graphics Designing</option>
                      <option value="WordPress Team">WordPress Team</option>
                      <option value="Executive">Executive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Designation / Job Title
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Senior Full Stack Engineer"
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+92 (300) 123-4567"
                        className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Financial & Leaves */}
              <div className="space-y-4 pt-2 border-t border-[#1F293D]">
                <h4 className="text-xs font-bold text-[#5CC5FA] uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Salary & Leaves (PKR)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Base Salary (PKR)
                    </label>
                    <input
                      type="number"
                      value={baseSalary}
                      onChange={(e) => handleSalaryChange(Number(e.target.value))}
                      min={0}
                      step={1000}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Daily Wage (PKR)
                    </label>
                    <input
                      type="number"
                      value={dailyWage}
                      onChange={(e) => setDailyWage(Number(e.target.value))}
                      min={0}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Joining Date
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={joinDate}
                        onChange={(e) => setJoinDate(e.target.value)}
                        className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Casual Leaves</label>
                    <input
                      type="number"
                      value={casualLeaves}
                      onChange={(e) => setCasualLeaves(Number(e.target.value))}
                      min={0}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] rounded-xl px-3 py-1.5 text-xs text-white outline-none font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Sick Leaves</label>
                    <input
                      type="number"
                      value={sickLeaves}
                      onChange={(e) => setSickLeaves(Number(e.target.value))}
                      min={0}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] rounded-xl px-3 py-1.5 text-xs text-white outline-none font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Annual Leaves</label>
                    <input
                      type="number"
                      value={annualLeaves}
                      onChange={(e) => setAnnualLeaves(Number(e.target.value))}
                      min={0}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] rounded-xl px-3 py-1.5 text-xs text-white outline-none font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#1F293D] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#161F30] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white gradient-btn shadow-lg shadow-[#5470F4]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Employee...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Provision Employee</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
