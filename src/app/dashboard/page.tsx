'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../lib/api';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Coins,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Code2,
  Palette,
  Globe,
  Calendar,
  CalendarDays,
  Sparkles,
  ChevronRight,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await apiGet('/dashboard/stats');
      if (res.success) {
        setStats(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[#5470F4]/30 border-t-[#5470F4] rounded-full animate-spin" />
        <p className="text-xs text-gray-400">Loading live executive telemetry...</p>
      </div>
    );
  }

  const { projects, attendance, upcomingDeadlines } = stats;

  const departmentColors: Record<string, string> = {
    'Software Development': '#5470F4',
    'Digital Marketing (SEO)': '#5CC5FA',
    'Graphics Designing': '#A855F7',
    'WordPress Team': '#10B981',
  };

  const projectStatusData = [
    { name: 'In Progress', value: projects.active, color: '#5470F4' },
    { name: 'In Review', value: projects.inReview, color: '#F59E0B' },
    { name: 'Completed', value: projects.completed, color: '#10B981' },
    { name: 'Planning', value: projects.planning, color: '#6B7280' },
  ];

  const departmentBarData = (projects.departmentBreakdown || []).map((d: any) => ({
    name: d.department.replace('Digital Marketing (SEO)', 'Marketing/SEO').replace('Software Development', 'Software Dev'),
    total: d.totalProjects,
    active: d.activeProjects,
    progress: d.avgProgress,
  }));

  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#111827] via-[#161F30] to-[#0E1424] border border-[#1F293D] p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#5CC5FA] bg-[#5470F4]/10 px-3 py-1 rounded-full border border-[#5470F4]/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome back, {user?.name} ({user?.role})</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Company Operations & Performance Command Center
          </h1>
          <p className="text-xs text-gray-400">
            Real-time project velocity, team attendance health, and deduction oversight for Neximet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1F293D] hover:bg-[#2A374F] text-white border border-[#2A374F] flex items-center gap-2 transition-all shadow-sm"
          >
            <FolderKanban className="w-4 h-4 text-[#5CC5FA]" />
            <span>View All Projects</span>
          </Link>
          <Link
            href="/attendance"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold gradient-btn text-white flex items-center gap-2 shadow-lg shadow-[#5470F4]/20"
          >
            <Clock className="w-4 h-4" />
            <span>Attendance Portal</span>
          </Link>
        </div>
      </div>

      {/* Executive Approvals Banner */}
      {(user?.role === 'CEO' || user?.role === 'Super Admin') && stats.pendingLeavesCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <CalendarDays className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Pending Leave Applications Awaiting Review</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-extrabold">
                  {stats.pendingLeavesCount} Pending
                </span>
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Staff members have submitted leave requests requiring Executive approval.
              </p>
            </div>
          </div>
          <Link
            href="/leaves"
            className="px-4 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1.5 transition-all shadow-sm shrink-0"
          >
            <span>Review & Approve Leaves</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Projects Onboard */}
        <div className="bg-[#111827] border border-[#1F293D] hover:border-[#5470F4]/40 p-5 rounded-2xl transition-all shadow-md group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Projects Onboard</span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <FolderKanban className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{projects.total}</span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center">
              {projects.active} Active
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
            <span>{projects.completed} Completed</span>
            <span>{projects.inReview} In Review</span>
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="bg-[#111827] border border-[#1F293D] hover:border-[#10B981]/40 p-5 rounded-2xl transition-all shadow-md group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Attendance Today</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{attendance.checkedInToday}</span>
            <span className="text-xs text-gray-400">/ {attendance.totalEmployees} Employees</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
            <span className="text-emerald-400">{attendance.presentCount} On Time</span>
            <span className="text-amber-400 font-semibold">{attendance.lateCount} Late</span>
            <span className="text-rose-400">{attendance.absentCount} Absent</span>
          </div>
        </div>

        {/* Monthly Deductions */}
        <div className="bg-[#111827] border border-[#1F293D] hover:border-rose-500/40 p-5 rounded-2xl transition-all shadow-md group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Late Deductions (Mo)</span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">PKR {attendance.monthlyDeductions.toLocaleString()}</span>
            <span className="text-xs font-semibold text-rose-400">Accrued</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
            <span>Today: PKR {attendance.todayDeductions.toLocaleString()}</span>
            <Link href="/deduction-settings" className="text-[#5CC5FA] hover:underline flex items-center">
              Rules ↗
            </Link>
          </div>
        </div>

        {/* Remaining Leaves / Holidays */}
        <div className="bg-[#111827] border border-[#1F293D] hover:border-purple-500/40 p-5 rounded-2xl transition-all shadow-md group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Your Holidays Left</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">
              {(user?.leaveBalances?.casual || 0) + (user?.leaveBalances?.sick || 0) + (user?.leaveBalances?.annual || 0)}
            </span>
            <span className="text-xs font-semibold text-purple-400">Days Balance</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
            <span>Casual: {user?.leaveBalances?.casual || 0}</span>
            <span>Sick: {user?.leaveBalances?.sick || 0}</span>
            <span>Annual: {user?.leaveBalances?.annual || 0}</span>
          </div>
        </div>
      </div>

      {/* Graphical Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Project Load & Average Completion */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Departmental Project Distribution & Progress</span>
              </h3>
              <p className="text-xs text-gray-400">
                Number of active projects and average completion % per specialized team
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[#5CC5FA] bg-[#5470F4]/10 border border-[#5470F4]/30 px-3 py-1 rounded-full">
              Live Progress
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} interval={0} />
                <YAxis stroke="#9CA3AF" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161F30',
                    borderColor: '#1F293D',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="progress" name="Avg Completion (%)" fill="#5470F4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="active" name="Active Projects" fill="#5CC5FA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Status Donut */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Project Pipeline Status</h3>
            <p className="text-xs text-gray-400 mt-0.5">Overall distribution across workflow states</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161F30',
                    borderColor: '#1F293D',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#1F293D] pt-3">
            {projectStatusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-gray-400">{item.name}:</span>
                <span className="font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Departments Showcase Cards & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Teams Breakdown */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Multidisciplinary Team Squads</h3>
            <Link href="/employees" className="text-xs text-[#5CC5FA] hover:underline flex items-center gap-1">
              <span>View All 10 Members</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.departmentBreakdown?.map((dept: any) => {
              const color = departmentColors[dept.department] || '#5470F4';
              return (
                <div
                  key={dept.department}
                  className="p-4 rounded-2xl bg-[#161F30]/80 border border-[#1F293D] hover:border-[#5470F4]/40 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{dept.department}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F293D] text-gray-300">
                      {dept.totalProjects} Projects
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>Completion Velocity</span>
                      <span className="font-semibold text-white">{dept.avgProgress}%</span>
                    </div>
                    <div className="w-full bg-[#0B0F19] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${dept.avgProgress}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                    <span>Active Workflows: <strong className="text-white">{dept.activeProjects}</strong></span>
                    <Link
                      href={`/projects?dept=${encodeURIComponent(dept.department)}`}
                      className="text-[#5CC5FA] hover:underline font-semibold"
                    >
                      Inspect Team →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Critical Deadlines Radar */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Target Deadlines</span>
            </h3>
            <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
              Upcoming
            </span>
          </div>

          <div className="space-y-3">
            {upcomingDeadlines && upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((proj: any) => {
                const daysLeft = Math.ceil((new Date(proj.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <Link
                    key={proj._id}
                    href={`/projects/${proj._id}`}
                    className="block p-3 rounded-xl bg-[#161F30]/60 border border-[#1F293D] hover:border-[#5470F4]/40 hover:bg-[#161F30] transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400">{proj.code}</span>
                        <h4 className="text-xs font-bold text-white group-hover:text-[#5CC5FA] transition-colors truncate max-w-[180px]">
                          {proj.title}
                        </h4>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${daysLeft <= 14 ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                        {daysLeft > 0 ? `${daysLeft}d left` : 'Due today'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-gray-400">
                      <span>{proj.clientName}</span>
                      <span className="text-white font-semibold">{proj.completionPercentage}% done</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 py-4 text-center">No critical deadlines pending</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
