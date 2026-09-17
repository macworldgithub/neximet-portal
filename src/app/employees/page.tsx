'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../lib/api';
import {
  Users,
  Code2,
  TrendingUp,
  Palette,
  Globe,
  Building2,
  Mail,
  Phone,
  Coins,
  ShieldCheck,
  Search,
} from 'lucide-react';

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('All');
  const [search, setSearch] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/auth/users');
      if (res.success) {
        setEmployees(res.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const departments = [
    'All',
    'Executive',
    'Software Development',
    'Digital Marketing (SEO)',
    'Graphics Designing',
    'WordPress Team',
  ];

  const filtered = employees.filter((emp) => {
    const matchesDept = selectedDept === 'All' || emp.department === selectedDept;
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.designation.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const getDeptIcon = (dept: string) => {
    switch (dept) {
      case 'Software Development':
        return <Code2 className="w-4 h-4 text-blue-400" />;
      case 'Digital Marketing (SEO)':
        return <TrendingUp className="w-4 h-4 text-cyan-400" />;
      case 'Graphics Designing':
        return <Palette className="w-4 h-4 text-purple-400" />;
      case 'WordPress Team':
        return <Globe className="w-4 h-4 text-emerald-400" />;
      default:
        return <Building2 className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
          <Users className="w-6 h-6 text-[#5470F4]" />
          <span>Team Directory & Organizational Roster</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Complete personnel roster across Software Development, SEO, Graphics, and WordPress engineering departments.
        </p>
      </div>

      {/* Filters & Search */}
      <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-4 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${selectedDept === dept
                  ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/30'
                  : 'bg-[#161F30] text-gray-400 hover:text-white hover:bg-[#1E293D]'
                }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by employee name, designation, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none"
          />
        </div>
      </div>

      {/* Employee Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-[#5470F4]/30 border-t-[#5470F4] rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading team directory...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((emp) => (
            <div
              key={emp._id}
              className="bg-[#111827] border border-[#1F293D] hover:border-[#5470F4]/50 rounded-3xl p-6 shadow-xl space-y-4 hover:shadow-2xl hover:shadow-[#5470F4]/10 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center font-black text-base text-[#5CC5FA] shadow-md shadow-[#5470F4]/10 shrink-0">
                      {emp.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{emp.name}</h4>
                      <p className="text-xs text-[#5CC5FA] font-medium">{emp.designation}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${emp.role === 'CEO'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : emp.role === 'Project Manager'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : emp.role === 'Team Manager'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                    {emp.role}
                  </span>
                </div>

                <div className="space-y-2 text-xs border-t border-[#1F293D] pt-3">
                  <div className="flex items-center gap-2 text-gray-300">
                    {getDeptIcon(emp.department)}
                    <span>{emp.department}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-mono text-[11px] truncate">{emp.email}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-mono text-[11px]">{emp.phone || '+92 (300) 123-4567'}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#1F293D] pt-3 flex items-center justify-between text-[11px] text-gray-400">
                <span>Daily Wage Base: <strong className="text-white font-mono">PKR {(emp.dailyWage || 4000).toLocaleString()}</strong></span>
                <span className="text-emerald-400 font-semibold">Active Staff</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
