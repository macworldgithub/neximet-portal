'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../lib/api';
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
  Code2,
  TrendingUp,
  Palette,
  Globe,
  X,
} from 'lucide-react';

function ProjectsContent() {
  const searchParams = useSearchParams();
  const initialDept = searchParams.get('dept') || 'All';

  const { user, hasRole } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(initialDept);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New project form state
  const [newProject, setNewProject] = useState({
    title: '',
    code: '',
    clientName: '',
    department: 'Software Development',
    description: '',
    status: 'planning',
    priority: 'Medium',
    budget: 2500000,
    estimatedHours: 160,
    deadline: '',
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      let endpoint = `/projects?department=${encodeURIComponent(selectedDept)}&status=${encodeURIComponent(selectedStatus)}`;
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
  }, [selectedDept, selectedStatus, searchQuery]);

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
          department: 'Software Development',
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

  const departments = [
    { label: 'All Teams', value: 'All' },
    { label: 'Software Development', value: 'Software Development' },
    { label: 'Digital Marketing (SEO)', value: 'Digital Marketing (SEO)' },
    { label: 'Graphics Designing', value: 'Graphics Designing' },
    { label: 'WordPress Team', value: 'WordPress Team' },
  ];

  const statuses = [
    { label: 'All Statuses', value: 'All' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'In Review', value: 'review' },
    { label: 'Planning', value: 'planning' },
    { label: 'Completed', value: 'completed' },
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
    <div className="space-y-8">
      {/* Header & New Project action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-[#5470F4]" />
            <span>Enterprise Projects Portfolio</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage project scopes, secure credentials vaults, timelines & deadlines, and resource allocations.
          </p>
        </div>

        {hasRole('CEO', 'Project Manager') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold gradient-btn text-white flex items-center gap-2 shadow-lg shadow-[#5470F4]/20 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Project</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-4 space-y-4 shadow-xl">
        {/* Department Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {departments.map((dept) => (
            <button
              key={dept.value}
              onClick={() => setSelectedDept(dept.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${selectedDept === dept.value
                  ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/30'
                  : 'bg-[#161F30] text-gray-400 hover:text-white hover:bg-[#1E293D]'
                }`}
            >
              {dept.label}
            </button>
          ))}
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by project name, code (e.g. NX-AI-01), or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-gray-300 outline-none"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
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
        <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-12 text-center space-y-3">
          <FolderKanban className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No projects found</h3>
          <p className="text-xs text-gray-400">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const daysLeft = Math.ceil(
              (new Date(proj.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
            const deptStyle = getDeptColor(proj.department);

            return (
              <div
                key={proj._id}
                className="bg-[#111827] border border-[#1F293D] hover:border-[#5470F4]/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:shadow-2xl hover:shadow-[#5470F4]/10 transition-all group relative"
              >
                <div className="space-y-4">
                  {/* Top Bar: Code & Department Tag */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#5CC5FA] bg-[#161F30] px-2.5 py-1 rounded-lg border border-[#1F293D]">
                      {proj.code}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${deptStyle}`}>
                      {proj.department}
                    </span>
                  </div>

                  {/* Title & Client */}
                  <div>
                    <Link
                      href={`/projects/${proj._id}`}
                      className="text-base font-bold text-white group-hover:text-[#5CC5FA] transition-colors line-clamp-1 block"
                    >
                      {proj.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">Client: <span className="text-gray-300 font-semibold">{proj.clientName}</span></p>
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                    {proj.description || 'No description provided.'}
                  </p>

                  {/* Visual Completion Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-medium">Completion Progress</span>
                      <span className="font-bold text-white">{proj.completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-[#0B0F19] rounded-full h-2.5 overflow-hidden p-0.5 border border-[#1F293D]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#5470F4] to-[#5CC5FA] transition-all duration-500"
                        style={{ width: `${proj.completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Scope & Credentials Badge Indicators */}
                  <div className="flex items-center gap-2 pt-1">
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

                {/* Footer: Deadlines, Team Avatars & Action Link */}
                <div className="border-t border-[#1F293D] mt-5 pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span className={daysLeft <= 10 ? 'text-rose-400 font-semibold' : ''}>
                      {daysLeft > 0 ? `${daysLeft} days remaining` : 'Deadline passed'}
                    </span>
                  </div>

                  <Link
                    href={`/projects/${proj._id}`}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#161F30] hover:bg-[#5470F4] text-white transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Manage</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#5470F4]" />
                <span>Initialize New Project</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Project Title</label>
                  <input
                    type="text"
                    required
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    placeholder="e.g. AI Workflow Optimization"
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Project Code</label>
                  <input
                    type="text"
                    required
                    value={newProject.code}
                    onChange={(e) => setNewProject({ ...newProject, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. NX-AI-08"
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white uppercase outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Client Name</label>
                  <input
                    type="text"
                    required
                    value={newProject.clientName}
                    onChange={(e) => setNewProject({ ...newProject, clientName: e.target.value })}
                    placeholder="e.g. Stripe Inc."
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Department</label>
                  <select
                    value={newProject.department}
                    onChange={(e) => setNewProject({ ...newProject, department: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="Software Development">Software Development</option>
                    <option value="Digital Marketing (SEO)">Digital Marketing (SEO)</option>
                    <option value="Graphics Designing">Graphics Designing</option>
                    <option value="WordPress Team">WordPress Team</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Target Deadline</label>
                  <input
                    type="date"
                    required
                    value={newProject.deadline}
                    onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Budget (PKR)</label>
                  <input
                    type="number"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({ ...newProject, budget: Number(e.target.value) })}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Description & Scope Summary</label>
                <textarea
                  rows={3}
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Outline the core deliverables and objectives..."
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white shadow-md shadow-[#5470F4]/30"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
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
