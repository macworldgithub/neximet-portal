'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../lib/api';
import EditProjectModal from '../../components/projects/EditProjectModal';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Coins,
  FileText,
  Key,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit3,
  Code2,
  TrendingUp,
  Palette,
  Globe,
  X,
  Sparkles,
} from 'lucide-react';

function ProjectsContent() {
  const searchParams = useSearchParams();
  const initialDeptParam = searchParams.get('dept');

  const { user, hasRole, isSuperAdmin } = useAuth();
  const canManageProjects =
    !user ||
    isSuperAdmin ||
    hasRole('CEO', 'Super Admin', 'Project Manager', 'Team Manager') ||
    ['CEO', 'Super Admin', 'Project Manager', 'Team Manager'].includes(user?.role || '');

  const defaultDept = isSuperAdmin ? (initialDeptParam || 'All') : (user?.department || 'Software Development');
  const [selectedDept, setSelectedDept] = useState(defaultDept);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);

  // New project form state
  const [newProject, setNewProject] = useState<{
    title: string;
    code: string;
    clientName: string;
    department: string;
    description: string;
    status: string;
    priority: string;
    budget: number;
    estimatedHours: number;
    deadline: string;
  }>({
    title: '',
    code: '',
    clientName: '',
    department: user?.department && user.department !== 'Executive' ? user.department : 'Software Development',
    description: '',
    status: 'planning',
    priority: 'Medium',
    budget: 2500000,
    estimatedHours: 160,
    deadline: '',
  });

  // Sync selected department when user loads or role is determined
  useEffect(() => {
    if (!isSuperAdmin && user?.department && user.department !== 'Executive') {
      setSelectedDept(user.department);
      setNewProject((prev) => ({ ...prev, department: user.department as string }));
    } else if (isSuperAdmin && initialDeptParam) {
      setSelectedDept(initialDeptParam);
    }
  }, [user, isSuperAdmin, initialDeptParam]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const activeDept = !isSuperAdmin && user?.department ? user.department : selectedDept;
      let endpoint = `/projects?department=${encodeURIComponent(activeDept)}&status=${encodeURIComponent(selectedStatus)}`;
      if (searchQuery) {
        endpoint += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const res = await apiGet(endpoint);
      if (res.success) {
        setProjects(res.projects);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [selectedDept, selectedStatus, searchQuery, user]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost('/projects', newProject);
      if (res.success) {
        setShowCreateModal(false);
        fetchProjects();
        setNewProject({
          title: '',
          code: '',
          clientName: '',
          department: user?.department && user.department !== 'Executive' ? user.department : 'Software Development',
          description: '',
          status: 'planning',
          priority: 'Medium',
          budget: 2500000,
          estimatedHours: 160,
          deadline: '',
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const departments = isSuperAdmin
    ? [
        { label: 'All Teams', value: 'All' },
        { label: 'Software Development', value: 'Software Development' },
        { label: 'Digital Marketing (SEO)', value: 'Digital Marketing (SEO)' },
        { label: 'Graphics Designing', value: 'Graphics Designing' },
        { label: 'WordPress Team', value: 'WordPress Team' },
      ]
    : [
        { label: `Team: ${user?.department || 'My Team'}`, value: user?.department || 'Software Development' },
      ];

  const statuses = [
    { label: 'All Statuses', value: 'All' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'In Review', value: 'review' },
    { label: 'Planning', value: 'planning' },
    { label: 'Completed', value: 'completed' },
    { label: 'On Hold', value: 'on_hold' },
  ];

  const getDeptColor = (dept: string) => {
    switch (dept) {
      case 'Software Development':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'Digital Marketing (SEO)':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
      case 'Graphics Designing':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'WordPress Team':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-full overflow-hidden">
      {/* Header & New Project action */}
      <div className="bg-[#111827] border border-[#1F293D] rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-7 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#5470F4]/15 text-[#5CC5FA] border border-[#5470F4]/30 uppercase tracking-wider">
              Management Portal
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <FolderKanban className="w-7 h-7 text-[#5470F4] shrink-0" />
            <span>Enterprise Projects Portfolio</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-2xl leading-relaxed">
            Manage project scopes, secure credentials vaults, timelines & deadlines, and resource allocations across all departments.
          </p>
        </div>

        {canManageProjects && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs sm:text-sm font-bold gradient-btn text-white flex items-center justify-center gap-2.5 shadow-xl shadow-[#5470F4]/25 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 z-10"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Project</span>
          </button>
        )}

        <div className="absolute right-0 top-0 w-72 h-72 bg-[#5470F4]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-[#111827] border border-[#1F293D] rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
        {/* Department Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {departments.map((dept) => (
            <button
              key={dept.value}
              onClick={() => setSelectedDept(dept.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedDept === dept.value
                  ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/30'
                  : 'bg-[#161F30] text-gray-400 hover:text-white hover:bg-[#1E293D]'
              }`}
            >
              {dept.label}
            </button>
          ))}
        </div>

        {/* Search & Status Filters & Quick Action */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by project name, code (e.g. NX-AI-01), or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 sm:w-auto w-full">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 sm:flex-none bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-gray-300 outline-none transition-all"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {canManageProjects && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white flex items-center justify-center gap-1.5 shadow-md shadow-[#5470F4]/20 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
                title="Create New Project"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Project</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-[#5470F4]/30 border-t-[#5470F4] rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading projects portfolio...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-[#111827] border border-[#1F293D] rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center space-y-3 shadow-xl">
          <FolderKanban className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No projects found</h3>
          <p className="text-xs text-gray-400">Try adjusting your filters or search terms.</p>
          {canManageProjects && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/25"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
          {projects.map((proj) => {
            const daysLeft = Math.ceil(
              (new Date(proj.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
            const deptStyle = getDeptColor(proj.department);

            return (
              <div
                key={proj._id}
                className="bg-[#111827] border border-[#1F293D] hover:border-[#5470F4]/50 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between hover:shadow-2xl hover:shadow-[#5470F4]/10 transition-all group relative"
              >
                <div className="space-y-4">
                  {/* Top Bar: Code & Department Tag */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-[#5CC5FA] bg-[#161F30] px-2.5 py-1 rounded-lg border border-[#1F293D]">
                      {proj.code}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border truncate max-w-[180px] ${deptStyle}`}>
                      {proj.department}
                    </span>
                  </div>

                  {/* Title & Client */}
                  <div>
                    <Link
                      href={`/projects/${proj._id}`}
                      className="text-base font-bold text-white group-hover:text-[#5CC5FA] transition-colors line-clamp-1 block"
                      title={proj.title}
                    >
                      {proj.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Client: <span className="text-gray-300 font-semibold">{proj.clientName}</span>
                    </p>
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                    {proj.description || 'No description provided.'}
                  </p>

                  {/* Visual Completion Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-medium">Completion Progress</span>
                      <span className="font-bold text-white">{proj.completionPercentage || 0}%</span>
                    </div>
                    <div className="w-full bg-[#0B0F19] rounded-full h-2.5 overflow-hidden p-0.5 border border-[#1F293D]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#5470F4] to-[#5CC5FA] transition-all duration-500"
                        style={{ width: `${proj.completionPercentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Scope & Credentials Badge Indicators */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {(proj.scopeDocuments && proj.scopeDocuments.length > 0) || proj.scopeDocument?.fileUrl ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {proj.scopeDocuments?.length > 1
                          ? `${proj.scopeDocuments.length} Scopes Attached`
                          : 'Scope Attached'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500">No scope file</span>
                    )}

                    {proj.credentials && proj.credentials.length > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                        <Key className="w-3 h-3" />
                        {proj.credentials.length} Keys in Vault
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer: Deadlines, Team Avatars & Action Links */}
                <div className="border-t border-[#1F293D] mt-5 pt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span className={daysLeft <= 10 ? 'text-rose-400 font-semibold' : ''}>
                      {daysLeft > 0 ? `${daysLeft}d remaining` : 'Passed'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {canManageProjects && (
                      <button
                        onClick={() => setEditingProject(proj)}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold bg-[#161F30] hover:bg-[#1E293D] text-gray-300 hover:text-white transition-all flex items-center gap-1.5 border border-[#1F293D]"
                        title="Edit Project Name & Details"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#5CC5FA]" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    )}

                    <Link
                      href={`/projects/${proj._id}`}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#161F30] hover:bg-[#5470F4] text-white transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Manage</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto">
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl sm:rounded-3xl max-w-xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-4 sm:px-7 sm:py-5 border-b border-[#1F293D] bg-[#161F30]/60">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#5470F4]/15 border border-[#5470F4]/30 flex items-center justify-center text-[#5CC5FA]">
                  <Plus className="w-4 h-4" />
                </div>
                <span>Initialize New Project</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1E293D] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-7 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Project Title / Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                      placeholder="e.g. AI Workflow Optimization"
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Project Code <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newProject.code}
                      onChange={(e) => setNewProject({ ...newProject, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. NX-AI-08"
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white uppercase outline-none transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Client Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newProject.clientName}
                      onChange={(e) => setNewProject({ ...newProject, clientName: e.target.value })}
                      placeholder="e.g. Stripe Inc."
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">Department</label>
                    <select
                      value={newProject.department}
                      onChange={(e) => setNewProject({ ...newProject, department: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                    >
                      <option value="Software Development">Software Development</option>
                      <option value="Digital Marketing (SEO)">Digital Marketing (SEO)</option>
                      <option value="Graphics Designing">Graphics Designing</option>
                      <option value="WordPress Team">WordPress Team</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">Priority</label>
                    <select
                      value={newProject.priority}
                      onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Target Deadline <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={newProject.deadline}
                      onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">Budget (PKR)</label>
                    <input
                      type="number"
                      value={newProject.budget}
                      onChange={(e) => setNewProject({ ...newProject, budget: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Description & Scope Summary
                  </label>
                  <textarea
                    rows={3}
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Outline the core deliverables, milestones, and objectives..."
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white outline-none transition-all resize-none placeholder-gray-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 px-5 py-4 sm:px-7 sm:py-5 border-t border-[#1F293D] bg-[#161F30]/60">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#1E293D] transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/25 hover:scale-[1.01] active:scale-[0.99] transition-all text-center"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <EditProjectModal
          isOpen={Boolean(editingProject)}
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onUpdated={(updated) => {
            setProjects((prev) =>
              prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p))
            );
          }}
        />
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-[#5470F4]/30 border-t-[#5470F4] rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading projects portfolio...</p>
        </div>
      }
    >
      <ProjectsContent />
    </React.Suspense>
  );
}
