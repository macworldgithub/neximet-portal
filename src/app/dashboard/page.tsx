'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../lib/api';
import { attendanceTime } from '../../lib/attendance';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Coins,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Sparkles,
  ChevronRight,
  Users,
  UserCheck,
  Briefcase,
  Layers,
  ListTodo,
  CheckCircle,
  XCircle,
  PhoneCall,
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
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--:--';
    return attendanceTime(isoString);
  };

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[#5470F4]/30 border-t-[#5470F4] rounded-full animate-spin" />
        <p className="text-xs text-gray-400">Loading personalized workspace telemetry...</p>
      </div>
    );
  }

  const {
    projects = { total: 0, active: 0, completed: 0, inReview: 0, planning: 0, departmentBreakdown: [] },
    attendance = {
      totalEmployees: 0,
      checkedInToday: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      todayDeductions: 0,
      monthlyDeductions: 0,
      deptTotalEmployees: 0,
      deptCheckedInToday: 0,
      deptPresentCount: 0,
      deptLateCount: 0,
      deptAbsentCount: 0,
      myTodayStatus: null,
      myMonthlyPresentCount: 0,
      myMonthlyLateCount: 0,
      myMonthlyDeductions: 0,
    },
    tasks = { total: 0, active: 0, review: 0, done: 0, todo: 0, myRecentTasks: [] },
    upcomingDeadlines = [],
    pendingLeavesCount = 0,
    squadMembers = [],
    userScope = {
      isExecutive: user?.role === 'CEO' || user?.role === 'Super Admin',
      isManager: user?.role === 'Project Manager' || user?.role === 'Team Manager',
      isMember: user?.role !== 'CEO' && user?.role !== 'Super Admin' && user?.role !== 'Project Manager' && user?.role !== 'Team Manager',
      role: user?.role,
      department: user?.department,
    },
  } = stats;

  const isExecutive = userScope.isExecutive;
  const isManager = userScope.isManager;
  const isMember = userScope.isMember;

  const departmentColors: Record<string, string> = {
    'Software Development': '#5470F4',
    'Digital Marketing (SEO)': '#5CC5FA',
    'Graphics Designing': '#A855F7',
    'WordPress Team': '#10B981',
  };

  const projectStatusData = [
    { name: 'In Progress', value: projects.active || 0, color: '#5470F4' },
    { name: 'In Review', value: projects.inReview || 0, color: '#F59E0B' },
    { name: 'Completed', value: projects.completed || 0, color: '#10B981' },
    { name: 'Planning', value: projects.planning || 0, color: '#6B7280' },
  ];

  const departmentBarData = (projects.departmentBreakdown || []).map((d: any) => ({
    name: d.department
      ? d.department.replace('Digital Marketing (SEO)', 'Marketing/SEO').replace('Software Development', 'Software Dev')
      : 'General',
    total: d.totalProjects,
    active: d.activeProjects,
    progress: d.avgProgress,
  }));

  const totalLeaveBalance =
    (user?.leaveBalances?.casual || 0) +
    (user?.leaveBalances?.sick || 0) +
    (user?.leaveBalances?.annual || 0);

  return (
    <div className="space-y-8">
      {/* Dynamic Welcome Banner tailored to User Role & Department */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#111827] via-[#161F30] to-[#0E1424] border border-[#1F293D] p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#5CC5FA] bg-[#5470F4]/10 px-3 py-1 rounded-full border border-[#5470F4]/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Welcome back, {user?.name} &bull; {user?.designation || user?.role}
              {user?.department && user?.department !== 'Executive' ? ` (${user?.department})` : ''}
            </span>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            {isExecutive
              ? 'Company Operations & Executive Command Center'
              : isManager
              ? `${user?.department} Team Management Command`
              : 'My Workspace & Personal Telemetry'}
          </h1>

          <p className="text-xs text-gray-400">
            {isExecutive
              ? 'Real-time company-wide project delivery, multi-department attendance health, and deduction oversight.'
              : isManager
              ? `Real-time sprint velocity, squad check-in attendance, and milestone deadlines for the ${user?.department} squad.`
              : `Your personalized deliverables queue, daily check-in telemetry, monthly salary deduction status, and squad activity.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1F293D] hover:bg-[#2A374F] text-white border border-[#2A374F] flex items-center gap-2 transition-all shadow-sm"
          >
            <ListTodo className="w-4 h-4 text-[#5CC5FA]" />
            <span>{isMember ? 'My Jira Board' : 'Sprint Board'}</span>
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

      {/* Pending Leave Notification Banner */}
      {isExecutive && pendingLeavesCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <CalendarDays className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Pending Leave Applications Awaiting Executive Review</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-extrabold">
                  {pendingLeavesCount} Pending
                </span>
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Staff members have submitted formal leave requests requiring your review.
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

      {!isExecutive && pendingLeavesCount > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#5CC5FA]" />
            <span className="text-xs text-gray-300">
              You have <strong className="text-white">{pendingLeavesCount} leave request</strong> currently under executive review.
            </span>
          </div>
          <Link href="/leaves" className="text-xs text-[#5CC5FA] font-bold hover:underline flex items-center gap-1">
            <span>View Status</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* TOP 4 KPI CARDS: Dynamically mapped to user role & department */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* CARD 1: Projects (Executive/Manager) OR My Assigned Deliverables (Team Member) */}
        {isMember ? (
          <div className="bg-[#111827] border border-[#1F293D] hover:border-[#5470F4]/40 p-5 rounded-2xl transition-all shadow-md group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">My Assigned Tasks</span>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                <ListTodo className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{tasks.total || 0}</span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center">
                {tasks.active || 0} In Progress
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
              <span>{tasks.done || 0} Done</span>
              <span>{tasks.review || 0} In Review</span>
              <span>{tasks.todo || 0} To Do</span>
            </div>
          </div>
        ) : (
          <div className="bg-[#111827] border border-[#1F293D] hover:border-[#5470F4]/40 p-5 rounded-2xl transition-all shadow-md group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                {isExecutive ? 'Projects Onboard' : `${user?.department} Projects`}
              </span>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                <FolderKanban className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{projects.total || 0}</span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center">
                {projects.active || 0} Active
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
              <span>{projects.completed || 0} Completed</span>
              <span>{projects.inReview || 0} In Review</span>
            </div>
          </div>
        )}

        {/* CARD 2: Attendance Today (Company for Exec, Dept for Manager, Personal for Member) */}
        {isExecutive ? (
          <div className="bg-[#111827] border border-[#1F293D] hover:border-[#10B981]/40 p-5 rounded-2xl transition-all shadow-md group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Company Attendance Today</span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{attendance.checkedInToday || 0}</span>
              <span className="text-xs text-gray-400">/ {attendance.totalEmployees || 0} Staff</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
              <span className="text-emerald-400">{attendance.presentCount || 0} On Time</span>
              <span className="text-amber-400 font-semibold">{attendance.lateCount || 0} Late</span>
              <span className="text-rose-400">{attendance.absentCount || 0} Absent</span>
            </div>
          </div>
        ) : isManager ? (
          <div className="bg-[#111827] border border-[#1F293D] hover:border-[#10B981]/40 p-5 rounded-2xl transition-all shadow-md group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Squad Attendance Today</span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{attendance.deptCheckedInToday || 0}</span>
              <span className="text-xs text-gray-400">/ {attendance.deptTotalEmployees || 0} In Squad</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
              <span className="text-emerald-400">{attendance.deptPresentCount || 0} On Time</span>
              <span className="text-amber-400 font-semibold">{attendance.deptLateCount || 0} Late</span>
              <span className="text-rose-400">{attendance.deptAbsentCount || 0} Away</span>
            </div>
          </div>
        ) : (
          <div className="bg-[#111827] border border-[#1F293D] hover:border-[#10B981]/40 p-5 rounded-2xl transition-all shadow-md group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">My Attendance Today</span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {attendance.myTodayStatus?.checkIn ? formatTime(attendance.myTodayStatus.checkIn) : 'Not Clocked In'}
              </span>
              {attendance.myTodayStatus?.checkIn && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    attendance.myTodayStatus.isLate
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {attendance.myTodayStatus.isLate
                    ? `Late (+${attendance.myTodayStatus.minutesLate || 0}m)`
                    : 'On Time'}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
              <span className="text-emerald-400">
                Mo: {attendance.myMonthlyPresentCount || 0} Days Present
              </span>
              <span className="text-amber-400 font-semibold">
                {attendance.myMonthlyLateCount || 0} Late
              </span>
            </div>
          </div>
        )}

        {/* CARD 3: Deductions (Company for CEO, Personal for Manager/Member) */}
        {isExecutive ? (
          <div className="bg-[#111827] border border-[#1F293D] hover:border-rose-500/40 p-5 rounded-2xl transition-all shadow-md group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Company Late Deductions (Mo)</span>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                PKR {(attendance.monthlyDeductions || 0).toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-rose-400">Accrued</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
              <span>Today: PKR {(attendance.todayDeductions || 0).toLocaleString()}</span>
              <Link href="/deduction-settings" className="text-[#5CC5FA] hover:underline flex items-center">
                Rules ↗
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-[#111827] border border-[#1F293D] hover:border-rose-500/40 p-5 rounded-2xl transition-all shadow-md group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">My Salary Deductions (Mo)</span>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                PKR {(attendance.myMonthlyDeductions || 0).toLocaleString()}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  (attendance.myMonthlyDeductions || 0) > 0
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {(attendance.myMonthlyDeductions || 0) > 0 ? 'Deducted' : 'Clean Record'}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
              <span>Today: PKR {attendance.myTodayStatus?.deductionAmount || 0}</span>
              <Link href="/deduction-settings" className="text-[#5CC5FA] hover:underline flex items-center">
                View Rules ↗
              </Link>
            </div>
          </div>
        )}

        {/* CARD 4: Leave Balances & Holidays Left (Personal for all users) */}
        <div className="bg-[#111827] border border-[#1F293D] hover:border-purple-500/40 p-5 rounded-2xl transition-all shadow-md group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Your Holidays Left</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{totalLeaveBalance}</span>
            <span className="text-xs font-semibold text-purple-400">Days Balance</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-400 border-t border-[#1F293D] pt-2.5">
            <span>Casual: {user?.leaveBalances?.casual || 0}</span>
            <span>Sick: {user?.leaveBalances?.sick || 0}</span>
            <span>Annual: {user?.leaveBalances?.annual || 0}</span>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: Dynamic layout according to user role */}
      {isExecutive ? (
        /* Executive View: Departmental Bar Chart + Project Pipeline Donut */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                Live Velocity
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={departmentBarData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" horizontal={false} />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={10} />
                  <YAxis type="category" dataKey="name" width={100} stroke="#9CA3AF" fontSize={10} interval={0} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161F30',
                      borderColor: '#1F293D',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="progress" name="Avg Completion (%)" fill="#5470F4" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                  <Bar dataKey="active" name="Active Projects" fill="#5CC5FA" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Project Pipeline Status</h3>
              <p className="text-xs text-gray-400 mt-0.5">Overall distribution across workflow states</p>
            </div>

            <div className="h-56 w-full flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
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
      ) : (
        /* Team Member & Manager View: Personal Deliverables / Recent Tasks + Squad Presence */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left (2 cols): My Assigned Deliverables */}
          <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-[#5CC5FA]" />
                  <span>My Active Deliverables & Sprint Tasks</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Tasks assigned directly to you across active department projects
                </p>
              </div>
              <Link
                href="/projects"
                className="text-xs text-[#5CC5FA] font-bold hover:underline flex items-center gap-1"
              >
                <span>Full Jira Board</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {tasks.myRecentTasks && tasks.myRecentTasks.length > 0 ? (
              <div className="space-y-3 pt-2">
                {tasks.myRecentTasks.map((task: any) => {
                  const priorityColors: Record<string, string> = {
                    urgent: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                    high: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                    low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                  };

                  const statusBadges: Record<string, { label: string; class: string }> = {
                    in_progress: { label: 'In Progress', class: 'bg-[#5470F4]/20 text-[#5CC5FA]' },
                    review: { label: 'In Review', class: 'bg-amber-500/20 text-amber-300' },
                    done: { label: 'Done', class: 'bg-emerald-500/20 text-emerald-300' },
                    todo: { label: 'To Do', class: 'bg-gray-500/20 text-gray-300' },
                  };

                  const badge = statusBadges[task.status] || {
                    label: task.status || 'To Do',
                    class: 'bg-gray-500/20 text-gray-300',
                  };

                  return (
                    <div
                      key={task._id}
                      className="p-3.5 rounded-2xl bg-[#161F30]/70 border border-[#1F293D] hover:border-[#5470F4]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1F293D] text-[#5CC5FA]">
                            {task.issueKey || 'TASK'}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${
                              priorityColors[task.priority] || priorityColors.medium
                            }`}
                          >
                            {task.priority || 'medium'}
                          </span>
                          {task.project?.title && (
                            <span className="text-[11px] text-gray-400 truncate max-w-[200px]">
                              &bull; {task.project.title}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white">{task.title}</h4>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.class}`}>
                          {badge.label}
                        </span>
                        {task.deadline && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-500" />
                            {new Date(task.deadline).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-[#161F30]/40 border border-[#1F293D] text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white">All caught up! No active tasks assigned.</p>
                <p className="text-[11px] text-gray-400">
                  Head over to the Jira Sprint Board to pick up backlog items.
                </p>
              </div>
            )}
          </div>

          {/* Right (1 col): Department Squad Attendance Live */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#5CC5FA]" />
                  <span>{user?.department} Squad</span>
                </h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Office Live
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Colleagues currently active in your specialized team
              </p>
            </div>

            <div className="space-y-2.5 my-2 max-h-[300px] overflow-y-auto pr-1">
              {squadMembers && squadMembers.length > 0 ? (
                squadMembers.map((member: any) => {
                  const isCheckedIn = member.todayStatus !== 'not_checked_in' && member.todayStatus !== 'absent' && member.checkIn;
                  return (
                    <div
                      key={member._id}
                      className="p-2.5 rounded-xl bg-[#161F30]/60 border border-[#1F293D] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[11px] shrink-0 ${
                            isCheckedIn ? 'bg-emerald-600' : 'bg-gray-700'
                          }`}
                        >
                          {member.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate text-xs">{member.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{member.designation || member.role}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isCheckedIn ? (
                          <div className="space-y-0.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                member.isLate ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {member.isLate ? 'Late' : 'Present'}
                            </span>
                            <p className="text-[10px] text-gray-400 font-mono">{formatTime(member.checkIn)}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-500 bg-[#1F293D] px-2 py-0.5 rounded-full">
                            Not in
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-400 py-4 text-center">No squad peers in this department</p>
              )}
            </div>

            <div className="text-xs text-gray-400 border-t border-[#1F293D] pt-3 flex items-center justify-between">
              <span>Standard Shift:</span>
              <span className="font-bold text-white">09:30 AM - 06:00 PM</span>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SECTION: Departments Overview & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Teams Breakdown / Department Projects */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isExecutive ? 'Multidisciplinary Team Squads' : `${user?.department} Project Velocity`}
            </h3>
            <Link
              href="/projects"
              className="text-xs text-[#5CC5FA] hover:underline flex items-center gap-1"
            >
              <span>{isExecutive ? 'View All Projects' : 'View Team Projects'}</span>
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
                    <span>
                      Active Workflows: <strong className="text-white">{dept.activeProjects}</strong>
                    </span>
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
              {isExecutive ? 'Company Wide' : 'My Department'}
            </span>
          </div>

          <div className="space-y-3">
            {upcomingDeadlines && upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((proj: any) => {
                const daysLeft = Math.ceil(
                  (new Date(proj.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <Link
                    key={proj._id}
                    href={`/projects/${proj._id}`}
                    className="block p-3 rounded-xl bg-[#161F30]/60 border border-[#1F293D] hover:border-[#5470F4]/40 hover:bg-[#161F30] transition-all group"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400">{proj.code}</span>
                        <h4 className="text-xs font-bold text-white group-hover:text-[#5CC5FA] transition-colors break-words">
                          {proj.title}
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          daysLeft <= 14 ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
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
