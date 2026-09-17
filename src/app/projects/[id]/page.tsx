'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload, BASE_URL } from '../../../lib/api';
import {
  FolderKanban,
  FileText,
  Key,
  Calendar,
  Users,
  Clock,
  ArrowLeft,
  Upload,
  Download,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Coins,
  Building2,
  Sparkles,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user, hasRole } = useAuth();

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scope' | 'credentials' | 'timeline' | 'resources' | 'time'>('scope');

  // Vault state
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [showAddCredModal, setShowAddCredModal] = useState(false);
  const [newCred, setNewCred] = useState({
    platform: '',
    environment: 'Production',
    usernameOrEmail: '',
    passwordOrKey: '',
    endpointUrl: '',
    notes: '',
  });

  // Scope upload state
  const [scopeFile, setScopeFile] = useState<File | null>(null);
  const [scopeSummary, setScopeSummary] = useState('');
  const [uploadingScope, setUploadingScope] = useState(false);

  // Time log state
  const [showLogTimeModal, setShowLogTimeModal] = useState(false);
  const [newTimeLog, setNewTimeLog] = useState({
    hours: 4,
    description: '',
    billable: true,
  });

  // Resource allocation state
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUserToAssign, setSelectedUserToAssign] = useState('');
  const [roleInProject, setRoleInProject] = useState('Contributor');
  const [allocatedHours, setAllocatedHours] = useState(20);

  const fetchProjectData = async () => {
    try {
      const res = await apiGet(`/projects/${projectId}`);
      if (res.success) {
        setProject(res.project);
      }

      const tasksRes = await apiGet(`/tasks/project/${projectId}`);
      if (tasksRes.success) {
        setTasks(tasksRes.tasks);
      }

      const logsRes = await apiGet(`/tasks/timelogs/project/${projectId}`);
      if (logsRes.success) {
        setTimeLogs(logsRes.timeLogs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersForAssignment = async () => {
    try {
      const res = await apiGet('/auth/users');
      if (res.success) {
        setAllUsers(res.users);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjectData();
    fetchUsersForAssignment();
  }, [projectId]);

  // Handle revealing credentials
  const toggleRevealKey = (id: string) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyKey = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Add credential to vault
  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost(`/projects/${projectId}/credentials`, newCred);
      if (res.success) {
        setShowAddCredModal(false);
        setNewCred({
          platform: '',
          environment: 'Production',
          usernameOrEmail: '',
          passwordOrKey: '',
          endpointUrl: '',
          notes: '',
        });
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete credential
  const handleDeleteCredential = async (credId: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    try {
      const res = await apiDelete(`/projects/${projectId}/credentials/${credId}`);
      if (res.success) {
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Scope document upload
  const handleUploadScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeFile) return;

    setUploadingScope(true);
    const formData = new FormData();
    formData.append('scopeFile', scopeFile);
    formData.append('summary', scopeSummary);

    try {
      const res = await apiUpload(`/projects/${projectId}/scope`, formData);
      if (res.success) {
        setScopeFile(null);
        setScopeSummary('');
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingScope(false);
    }
  };

  // Log time
  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost('/tasks/timelogs', {
        project: projectId,
        hours: newTimeLog.hours,
        description: newTimeLog.description,
        billable: newTimeLog.billable,
      });
      if (res.success) {
        setShowLogTimeModal(false);
        setNewTimeLog({ hours: 4, description: '', billable: true });
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add team member to project
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToAssign) return;

    const currentMembers = project.assignedMembers || [];
    const updated = [
      ...currentMembers.map((m: any) => ({
        user: m.user._id || m.user,
        roleInProject: m.roleInProject,
        allocatedHoursPerWeek: m.allocatedHoursPerWeek,
      })),
      {
        user: selectedUserToAssign,
        roleInProject,
        allocatedHoursPerWeek: Number(allocatedHours),
      },
    ];

    try {
      const res = await apiPut(`/projects/${projectId}/resources`, { assignedMembers: updated });
      if (res.success) {
        setShowAddMemberModal(false);
        setSelectedUserToAssign('');
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle milestone status
  const handleToggleMilestone = async (milestoneIndex: number) => {
    if (!hasRole('CEO', 'Project Manager')) return;
    const currentMilestones = [...(project.milestones || [])];
    const target = currentMilestones[milestoneIndex];
    target.status = target.status === 'completed' ? 'in_progress' : 'completed';
    target.progress = target.status === 'completed' ? 100 : 50;

    try {
      const res = await apiPut(`/projects/${projectId}/milestones`, { milestones: currentMilestones });
      if (res.success) {
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-3 border-[#5470F4]/30 border-t-[#5470F4] rounded-full animate-spin" />
        <p className="text-xs text-gray-400">Loading project dossier...</p>
      </div>
    );
  }

  const daysLeft = Math.ceil(
    (new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-8">
      {/* Top Back & Header */}
      <div className="space-y-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Projects</span>
        </Link>

        {/* Project Profile Header */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs font-bold text-[#5CC5FA] bg-[#161F30] px-3 py-1 rounded-lg border border-[#1F293D]">
                {project.code}
              </span>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#5470F4]/15 text-[#5CC5FA] border border-[#5470F4]/30">
                {project.department}
              </span>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${project.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : project.status === 'in_progress'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                {project.status.replace('_', ' ')}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {project.title}
            </h1>
            <p className="text-xs text-gray-400 max-w-3xl leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-6 bg-[#0B0F19] p-4 rounded-2xl border border-[#1F293D]">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Completion</span>
              <span className="text-2xl font-black text-white">{project.completionPercentage}%</span>
            </div>
            <div className="border-l border-[#1F293D] pl-6">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Target Deadline</span>
              <span className="text-sm font-bold text-[#5CC5FA]">
                {new Date(project.deadline).toLocaleDateString()}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#1F293D] overflow-x-auto pb-1">
        {[
          { id: 'scope', label: 'Project Scope & Specs', icon: FileText, count: project.scopeDocument?.fileUrl ? 'Attached' : null },
          { id: 'credentials', label: 'Credentials Vault', icon: Key, count: project.credentials?.length || 0 },
          { id: 'timeline', label: 'Timeline & Milestones', icon: Calendar, count: `${project.completionPercentage}%` },
          { id: 'resources', label: 'Resource Allocation', icon: Users, count: project.assignedMembers?.length || 0 },
          { id: 'time', label: 'Time Management', icon: Clock, count: `${project.spentHours}h Logged` },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-4 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${isActive
                  ? 'border-[#5470F4] text-white bg-[#161F30]/50 rounded-t-xl'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#161F30]/20'
                }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#5CC5FA]' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1F293D] text-[#5CC5FA] font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Project Scope & Specs */}
      {activeTab === 'scope' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Attached Scope Document Card */}
            <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-[#1F293D] pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#5470F4]" />
                    <span>Official Project Scope Document</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Authorized deliverable specifications, contractual requirements & architecture outlines.
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  PDF / DOC Verified
                </span>
              </div>

              {project.scopeDocument?.fileName ? (
                <div className="bg-[#161F30] border border-[#1F293D] rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {project.scopeDocument.originalName || project.scopeDocument.fileName}
                        </h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Uploaded: {new Date(project.scopeDocument.uploadedAt).toLocaleDateString()} •{' '}
                          {(project.scopeDocument.fileSize / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <a
                      href={`${BASE_URL}${project.scopeDocument.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn text-white flex items-center gap-2 shadow-md shadow-[#5470F4]/20 hover:scale-[1.02] transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download File</span>
                    </a>
                  </div>

                  {project.scopeDocument.summary && (
                    <div className="border-t border-[#1F293D] pt-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                        Executive Scope Summary:
                      </span>
                      <p className="text-xs text-gray-300 leading-relaxed bg-[#0B0F19] p-3 rounded-xl border border-[#1F293D]">
                        {project.scopeDocument.summary}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-[#161F30]/40 rounded-2xl border border-dashed border-[#1F293D] space-y-2">
                  <FileText className="w-10 h-10 text-gray-500 mx-auto" />
                  <p className="text-xs font-semibold text-white">No scope document uploaded yet</p>
                  <p className="text-xs text-gray-400">Attach the signed project specification or proposal PDF.</p>
                </div>
              )}
            </div>

            {/* Scope Deliverables & Key Objectives */}
            <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white">Key Deliverable Objectives</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#161F30]/60 border border-[#1F293D] flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-white block">Production Reliability SLA</strong>
                    <span className="text-gray-400">99.9% uptime architecture with failover logic.</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#161F30]/60 border border-[#1F293D] flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-white block">Documentation & API Spec</strong>
                    <span className="text-gray-400">Comprehensive hand-off guides and schema definitions.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upload New Scope Sidebar */}
          {hasRole('CEO', 'Project Manager') && (
            <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-5 h-fit">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#5CC5FA]" />
                  <span>Update Scope Attachment</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">Upload a revised PDF or Word document for this project.</p>
              </div>

              <form onSubmit={handleUploadScope} className="space-y-4">
                <div className="border-2 border-dashed border-[#1F293D] hover:border-[#5470F4] rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    required
                    onChange={(e) => setScopeFile(e.target.files ? e.target.files[0] : null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-white block">
                    {scopeFile ? scopeFile.name : 'Click to browse document'}
                  </span>
                  <span className="text-[10px] text-gray-500 mt-1 block">PDF, DOC, DOCX up to 25MB</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Version Notes / Summary</label>
                  <textarea
                    rows={3}
                    value={scopeSummary}
                    onChange={(e) => setScopeSummary(e.target.value)}
                    placeholder="Brief description of revisions..."
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploadingScope || !scopeFile}
                  className="w-full py-2.5 rounded-xl text-xs font-bold gradient-btn text-white disabled:opacity-50"
                >
                  {uploadingScope ? 'Uploading Document...' : 'Upload Scope File'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Credentials Vault */}
      {activeTab === 'credentials' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111827] border border-[#1F293D] p-6 rounded-3xl shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-[#5CC5FA]" />
                <span>Encrypted Credentials & Platform Vault</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Centralized storage for API keys, server access, CMS logins, and SaaS tokens. Masked by default.
              </p>
            </div>

            {hasRole('CEO', 'Project Manager') && (
              <button
                onClick={() => setShowAddCredModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold gradient-btn text-white flex items-center gap-2 shadow-md shadow-[#5470F4]/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Platform Credential</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {project.credentials && project.credentials.length > 0 ? (
              project.credentials.map((cred: any) => {
                const isRevealed = !!revealedKeys[cred._id];
                const isCopied = copiedKeyId === cred._id;

                return (
                  <div
                    key={cred._id}
                    className="bg-[#111827] border border-[#1F293D] hover:border-[#5470F4]/40 rounded-2xl p-5 shadow-xl space-y-4 transition-all"
                  >
                    {/* Platform & Env */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#5470F4]/15 text-[#5CC5FA] rounded-xl border border-[#5470F4]/30">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{cred.platform}</h4>
                          <span className="text-[10px] text-gray-400 font-medium">{cred.environment}</span>
                        </div>
                      </div>

                      {hasRole('CEO', 'Project Manager') && (
                        <button
                          onClick={() => handleDeleteCredential(cred._id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete credential"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Username / Endpoint */}
                    {cred.usernameOrEmail && (
                      <div className="text-xs">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Username / ID</span>
                        <span className="text-gray-200 font-mono">{cred.usernameOrEmail}</span>
                      </div>
                    )}

                    {/* Masked Secret Key / Password */}
                    <div className="space-y-1">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">API Key / Secret</span>
                      <div className="flex items-center gap-2 bg-[#0B0F19] border border-[#1F293D] rounded-xl p-2.5">
                        <input
                          type={isRevealed ? 'text' : 'password'}
                          readOnly
                          value={cred.passwordOrKey}
                          className="bg-transparent text-xs text-emerald-400 font-mono w-full outline-none select-all"
                        />
                        <button
                          onClick={() => toggleRevealKey(cred._id)}
                          className="p-1 rounded-md text-gray-400 hover:text-white"
                          title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                        >
                          {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleCopyKey(cred._id, cred.passwordOrKey)}
                          className="p-1 rounded-md text-gray-400 hover:text-[#5CC5FA]"
                          title="Copy to clipboard"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Endpoint URL & Notes */}
                    {cred.endpointUrl && (
                      <div className="text-xs flex items-center justify-between border-t border-[#1F293D] pt-2.5">
                        <span className="text-gray-400 truncate max-w-[220px]">{cred.endpointUrl}</span>
                        <a
                          href={cred.endpointUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#5CC5FA] hover:underline flex items-center gap-1 font-semibold text-[11px]"
                        >
                          <span>Open URL</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {cred.notes && (
                      <p className="text-[11px] text-gray-400 bg-[#161F30] p-2.5 rounded-lg border border-[#1F293D]/60">
                        {cred.notes}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 p-12 text-center bg-[#111827] rounded-3xl border border-[#1F293D] space-y-2">
                <Key className="w-10 h-10 text-gray-500 mx-auto" />
                <p className="text-xs font-bold text-white">No platform credentials recorded</p>
                <p className="text-xs text-gray-400">Safely store WordPress logins, Stripe keys, or OpenAI tokens.</p>
              </div>
            )}
          </div>

          {/* Add Credential Modal */}
          {showAddCredModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#5CC5FA]" />
                  <span>Store Platform Credential</span>
                </h3>

                <form onSubmit={handleAddCredential} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Platform Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AWS S3, WP-Admin, Cloudflare"
                      value={newCred.platform}
                      onChange={(e) => setNewCred({ ...newCred, platform: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Environment</label>
                    <select
                      value={newCred.environment}
                      onChange={(e) => setNewCred({ ...newCred, environment: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="Production">Production</option>
                      <option value="Staging">Staging</option>
                      <option value="Development">Development</option>
                      <option value="QA">QA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Username / Email (Optional)</label>
                    <input
                      type="text"
                      placeholder="admin@neximet.com"
                      value={newCred.usernameOrEmail}
                      onChange={(e) => setNewCred({ ...newCred, usernameOrEmail: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">API Key / Secret / Password</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter sensitive key or password"
                      value={newCred.passwordOrKey}
                      onChange={(e) => setNewCred({ ...newCred, passwordOrKey: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Endpoint / Login URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newCred.endpointUrl}
                      onChange={(e) => setNewCred({ ...newCred, endpointUrl: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Notes / Instructions</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Read-only permissions..."
                      value={newCred.notes}
                      onChange={(e) => setNewCred({ ...newCred, notes: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
                    <button
                      type="button"
                      onClick={() => setShowAddCredModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white"
                    >
                      Save to Vault
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Timeline & Milestones */}
      {activeTab === 'timeline' && (
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#5470F4]" />
              <span>Project Roadmap & Milestone Execution</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Track deadlines, stage delivery completion, and release sign-offs.
            </p>
          </div>

          {/* Progress Overview Bar */}
          <div className="p-5 rounded-2xl bg-[#161F30] border border-[#1F293D] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-bold">Overall Project Velocity</span>
              <span className="text-white font-black text-sm">{project.completionPercentage}% Completed</span>
            </div>
            <div className="w-full bg-[#0B0F19] rounded-full h-3 p-0.5 border border-[#1F293D]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#5470F4] via-[#5CC5FA] to-[#61CE70] transition-all duration-500"
                style={{ width: `${project.completionPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 pt-1">
              <span>Kickoff: {new Date(project.startDate).toLocaleDateString()}</span>
              <span>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Milestones List */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Milestone Deliverables</h4>
            {project.milestones && project.milestones.length > 0 ? (
              project.milestones.map((milestone: any, index: number) => {
                const isCompleted = milestone.status === 'completed';
                return (
                  <div
                    key={milestone._id || index}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${isCompleted
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-[#161F30]/60 border-[#1F293D]'
                      }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <button
                        onClick={() => handleToggleMilestone(index)}
                        disabled={!hasRole('CEO', 'Project Manager')}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isCompleted
                            ? 'bg-emerald-500 text-white'
                            : 'border-2 border-gray-500 hover:border-[#5470F4]'
                          }`}
                      >
                        {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>

                      <div>
                        <h5 className={`text-xs font-bold ${isCompleted ? 'text-gray-300 line-through' : 'text-white'}`}>
                          {milestone.title}
                        </h5>
                        <span className="text-[10px] text-gray-400">
                          Target: {new Date(milestone.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : milestone.status === 'in_progress'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
                        {milestone.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 py-4">No milestones created yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Resource Allocation */}
      {activeTab === 'resources' && (
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#5470F4]" />
                <span>Assigned Team Squad & Capacity</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Staffing allocations, project roles, and committed weekly hours.
              </p>
            </div>

            {hasRole('CEO', 'Project Manager', 'Team Manager') && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold gradient-btn text-white flex items-center gap-2 shadow-md shadow-[#5470F4]/20"
              >
                <Plus className="w-4 h-4" />
                <span>Assign Team Member</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.assignedMembers && project.assignedMembers.length > 0 ? (
              project.assignedMembers.map((member: any, i: number) => {
                const u = member.user;
                if (!u) return null;
                return (
                  <div
                    key={u._id || i}
                    className="p-5 rounded-2xl bg-[#161F30] border border-[#1F293D] space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center font-black text-sm text-[#5CC5FA] shadow-sm shrink-0">
                        {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{u.name}</h4>
                        <p className="text-[11px] text-[#5CC5FA] font-medium">{member.roleInProject}</p>
                      </div>
                    </div>

                    <div className="border-t border-[#1F293D] pt-3 flex items-center justify-between text-xs">
                      <span className="text-gray-400">Committed Workload</span>
                      <span className="font-bold text-white bg-[#0B0F19] px-2.5 py-1 rounded-lg border border-[#1F293D]">
                        {member.allocatedHoursPerWeek || 20} hrs/week
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-500">
                      <span>{u.department} • {u.designation}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 col-span-3 py-6 text-center">
                No team members assigned yet.
              </p>
            )}
          </div>

          {/* Assign Member Modal */}
          {showAddMemberModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-white">Assign Member to Project</h3>
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Select Employee</label>
                    <select
                      required
                      value={selectedUserToAssign}
                      onChange={(e) => setSelectedUserToAssign(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="">-- Choose Member --</option>
                      {allUsers.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} ({u.role} - {u.department})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Role in this Project</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lead Engineer, UI Designer, SEO Specialist"
                      value={roleInProject}
                      onChange={(e) => setRoleInProject(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Allocated Hours per Week</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={60}
                      value={allocatedHours}
                      onChange={(e) => setAllocatedHours(Number(e.target.value))}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
                    <button
                      type="button"
                      onClick={() => setShowAddMemberModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white"
                    >
                      Confirm Assignment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Time Management */}
      {activeTab === 'time' && (
        <div className="space-y-6">
          {/* Header & Log Action */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#5470F4]" />
                <span>Time Management & Work Logs</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Track spent hours vs estimated budget, and maintain accurate client timesheets.
              </p>
            </div>

            <button
              onClick={() => setShowLogTimeModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold gradient-btn text-white flex items-center gap-2 shadow-md shadow-[#5470F4]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Log Work Hours</span>
            </button>
          </div>

          {/* Time & Budget Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
              <span className="text-xs font-bold text-gray-400 uppercase">Estimated Effort</span>
              <p className="text-2xl font-black text-white mt-1">{project.estimatedHours || 160} hrs</p>
            </div>

            <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
              <span className="text-xs font-bold text-gray-400 uppercase">Hours Logged</span>
              <p className="text-2xl font-black text-[#5CC5FA] mt-1">{project.spentHours || 0} hrs</p>
            </div>

            <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
              <span className="text-xs font-bold text-gray-400 uppercase">Project Budget</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">PKR {(project.budget || 2500000).toLocaleString()}</p>
            </div>
          </div>

          {/* Time Logs Stream */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Logged Work Activity</h4>
            <div className="space-y-3">
              {timeLogs && timeLogs.length > 0 ? (
                timeLogs.map((log: any) => (
                  <div
                    key={log._id}
                    className="p-4 rounded-2xl bg-[#161F30]/60 border border-[#1F293D] flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/30 flex items-center justify-center font-bold text-xs text-[#5CC5FA] shrink-0">
                        {log.user?.name ? log.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">{log.user?.name}</h5>
                        <p className="text-xs text-gray-300 mt-1">{log.description}</p>
                        <span className="text-[10px] text-gray-500 mt-1 block">
                          {new Date(log.date).toLocaleDateString()} • {log.billable ? 'Billable' : 'Non-billable'}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-[#5CC5FA] bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#1F293D]">
                      {log.hours} hrs
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 py-6 text-center">No time logs recorded yet.</p>
              )}
            </div>
          </div>

          {/* Log Time Modal */}
          {showLogTimeModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-white">Log Work Hours</h3>
                <form onSubmit={handleLogTime} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Hours Spent</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="16"
                      required
                      value={newTimeLog.hours}
                      onChange={(e) => setNewTimeLog({ ...newTimeLog, hours: Number(e.target.value) })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Work Description</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="What was completed during this block?"
                      value={newTimeLog.description}
                      onChange={(e) => setNewTimeLog({ ...newTimeLog, description: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="billable"
                      checked={newTimeLog.billable}
                      onChange={(e) => setNewTimeLog({ ...newTimeLog, billable: e.target.checked })}
                      className="rounded accent-[#5470F4]"
                    />
                    <label htmlFor="billable" className="text-xs text-gray-300 font-semibold cursor-pointer">
                      Mark as Billable Hours
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
                    <button
                      type="button"
                      onClick={() => setShowLogTimeModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white"
                    >
                      Submit Log
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
