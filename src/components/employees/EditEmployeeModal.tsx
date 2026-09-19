'use client';

import React, { useState, useEffect } from 'react';
import { apiPut } from '../../lib/api';
import {
  X,
  UserCheck,
  Coins,
  Phone,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Network,
} from 'lucide-react';

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  allEmployees: any[];
  onUpdated: (updatedUser: any) => void;
}

export default function EditEmployeeModal({
  isOpen,
  onClose,
  employee,
  allEmployees,
  onUpdated,
}: EditEmployeeModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Team Member');
  const [department, setDepartment] = useState('Software Development');
  const [designation, setDesignation] = useState('');
  const [baseSalary, setBaseSalary] = useState<string | number>('');
  const [dailyWage, setDailyWage] = useState<string | number>('');
  const [phone, setPhone] = useState('');
  const [casualLeaves, setCasualLeaves] = useState(10);
  const [sickLeaves, setSickLeaves] = useState(8);
  const [annualLeaves, setAnnualLeaves] = useState(14);
  const [reportsTo, setReportsTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (employee) {
      setName(employee.name || '');
      setRole(employee.role || 'Team Member');
      setDepartment(employee.department || 'Software Development');
      setDesignation(employee.designation || '');
      setBaseSalary(employee.baseSalary ?? '');
      setDailyWage(employee.dailyWage ?? '');
      setPhone(employee.phone || '');
      setCasualLeaves(employee.leaveBalances?.casual ?? 10);
      setSickLeaves(employee.leaveBalances?.sick ?? 8);
      setAnnualLeaves(employee.leaveBalances?.annual ?? 14);
      setReportsTo(employee.reportsTo?._id || employee.reportsTo || '');
      setError('');
      setSuccess(false);
    }
  }, [employee]);

  if (!isOpen || !employee) return null;

  const handleSalaryChange = (val: string) => {
    setBaseSalary(val);
    if (val !== '' && !isNaN(Number(val))) {
      setDailyWage(Math.round(Number(val) / 30));
    } else {
      setDailyWage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: any = {
        name: name.trim(),
        role,
        department,
        designation: designation.trim(),
        phone: phone.trim(),
        baseSalary: baseSalary !== '' ? Number(baseSalary) : null,
        dailyWage: dailyWage !== '' ? Number(dailyWage) : null,
        leaveBalances: {
          casual: Number(casualLeaves),
          sick: Number(sickLeaves),
          annual: Number(annualLeaves),
        },
        reportsTo: reportsTo ? reportsTo : null,
      };

      const res = await apiPut(`/auth/users/${employee._id}`, payload);

      if (res.success) {
        setSuccess(true);
        onUpdated(res.user);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.message || 'Failed to update employee details.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  // Filter potential managers (exclude self)
  const managerOptions = allEmployees.filter((emp) => emp._id !== employee._id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-[#1F293D] rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1F293D] sticky top-0 bg-[#111827]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Edit Employee & Compensation
                <span className="text-xs font-normal text-gray-400">({employee.email})</span>
              </h3>
              <p className="text-xs text-gray-400">Executive modification of salary, daily wage & reporting line</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Employee profile and compensation updated successfully!</span>
            </div>
          )}

          {/* Section 1: Role & Department */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-[#5CC5FA]" />
              <span>Role & Organizational Assignment</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Designation</label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                >
                  <option value="Executive">Executive</option>
                  <option value="Software Development">Software Development</option>
                  <option value="Digital Marketing (SEO)">Digital Marketing (SEO)</option>
                  <option value="Graphics Designing">Graphics Designing</option>
                  <option value="WordPress Team">WordPress Team</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">System Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                >
                  <option value="CEO">CEO (Chief Executive Officer)</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Team Manager">Team Manager</option>
                  <option value="Team Member">Team Member</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Reporting Line */}
          <div className="space-y-4 pt-2 border-t border-[#1F293D]">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-purple-400" />
              <span>Reporting Hierarchy (Manager)</span>
            </h4>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Reports Directly To</label>
              <select
                value={reportsTo}
                onChange={(e) => setReportsTo(e.target.value)}
                className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              >
                <option value="">Executive / Top-Level Management (None)</option>
                {managerOptions.map((mgr) => (
                  <option key={mgr._id} value={mgr._id}>
                    {mgr.name} — {mgr.designation} ({mgr.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Compensation & Salaries */}
          <div className="space-y-4 pt-2 border-t border-[#1F293D]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Executive Compensation Engine (PKR)</span>
              </h4>
              <span className="text-[11px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                CEO Controlled
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Base Monthly Salary (PKR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 180000 (leave blank if unassigned)"
                  value={baseSalary}
                  onChange={(e) => handleSalaryChange(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">Leave blank for unassigned salary state</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Daily Wage Rate (PKR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 6000 (auto-calculated as base / 30)"
                  value={dailyWage}
                  onChange={(e) => setDailyWage(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">Used for late attendance and absence deductions</p>
              </div>
            </div>
          </div>

          {/* Section 4: Contact & Leave Balances */}
          <div className="space-y-4 pt-2 border-t border-[#1F293D]">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#5CC5FA]" />
              <span>Contact & Annual Leave Quotas</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Casual (Days)</label>
                <input
                  type="number"
                  value={casualLeaves}
                  onChange={(e) => setCasualLeaves(Number(e.target.value))}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2.5 text-xs text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Sick / Medical</label>
                <input
                  type="number"
                  value={sickLeaves}
                  onChange={(e) => setSickLeaves(Number(e.target.value))}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2.5 text-xs text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Annual Holiday</label>
                <input
                  type="number"
                  value={annualLeaves}
                  onChange={(e) => setAnnualLeaves(Number(e.target.value))}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2.5 text-xs text-white outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white bg-[#161F30] hover:bg-[#1E293D] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-[#5470F4] hover:opacity-90 shadow-lg shadow-[#5470F4]/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save Compensation & Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
