'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiUpload, BASE_URL } from '../../../lib/api';
import JiraBoard from '../../../components/jira/JiraBoard';
import JiraBacklog from '../../../components/jira/JiraBacklog';
import JiraRoadmap from '../../../components/jira/JiraRoadmap';
import JiraIssueDetailModal from '../../../components/jira/JiraIssueDetailModal';
import CreateIssueModal from '../../../components/jira/CreateIssueModal';
import { JiraIssue } from '../../../components/jira/JiraIssueCard';
import EditProjectModal from '../../../components/projects/EditProjectModal';
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
  Edit3,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Coins,
  Building2,
  Sparkles,
  LayoutGrid,
  ListFilter,
  Search,
  Filter,
  X,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user, hasRole, isSuperAdmin } = useAuth();
  const canManageProjects = isSuperAdmin || hasRole('CEO', 'Super Admin', 'Project Manager', 'Team Manager');

  const [project, setProject] = useState<any>(null);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'jira' | 'scope' | 'credentials' | 'timeline' | 'resources' | 'time'>('jira');

  // Jira Workspace State
  const [jiraSubView, setJiraSubView] = useState<'board' | 'backlog' | 'roadmap'>('board');
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null);
  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [createIssueDefaultStatus, setCreateIssueDefaultStatus] = useState<JiraIssue['status']>('todo');
  const [jiraSearch, setJiraSearch] = useState('');
  const [jiraTypeFilter, setJiraTypeFilter] = useState('all');
  const [jiraAssigneeFilter, setJiraAssigneeFilter] = useState('all');
  const [jiraPriorityFilter, setJiraPriorityFilter] = useState('all');

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
  const [scopeTitle, setScopeTitle] = useState('');
  const [scopeFile, setScopeFile] = useState<File | null>(null);
  const [scopeSummary, setScopeSummary] = useState('');
  const [uploadingScope, setUploadingScope] = useState(false);
  const [deletingScopeId, setDeletingScopeId] = useState<string | null>(null);

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
  const [editingMember, setEditingMember] = useState<{
    user: any;
    roleInProject: string;
    allocatedHoursPerWeek: number;
  } | null>(null);

  // Edit Time log state
  const [editingTimeLog, setEditingTimeLog] = useState<{
    _id: string;
    hours: number;
    description: string;
    billable: boolean;
    date: string;
  } | null>(null);

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

  // Jira Handler Methods
  const handleMoveStatus = async (issueId: string, targetStatus: JiraIssue['status']) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t._id === issueId ? { ...t, status: targetStatus } : t))
    );

    try {
      const res = await apiPatch(`/tasks/${issueId}/status`, { status: targetStatus });
      if (res.success && res.task) {
        setTasks((prev) =>
          prev.map((t) => (t._id === issueId ? res.task : t))
        );
        if (selectedIssue && selectedIssue._id === issueId) {
          setSelectedIssue(res.task);
        }
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleQuickCreateIssue = async (title: string, issueType: JiraIssue['issueType']) => {
    try {
      const res = await apiPost('/tasks', {
        project: projectId,
        title,
        issueType,
        status: 'backlog',
        priority: 'Medium',
        storyPoints: 3,
      });
      if (res.success && res.task) {
        setTasks((prev) => [...prev, res.task]);
      }
    } catch (err) {
      console.error('Failed to quick create issue:', err);
    }
  };

  const handleUpdateIssue = (updatedIssue: JiraIssue) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === updatedIssue._id ? updatedIssue : t))
    );
    setSelectedIssue(updatedIssue);
  };

  const handleDeleteIssue = async (issueId: string) => {
    try {
      const res = await apiDelete(`/tasks/${issueId}`);
      if (res.success) {
        setTasks((prev) => prev.filter((t) => t._id !== issueId));
        if (selectedIssue?._id === issueId) {
          setSelectedIssue(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete issue:', err);
    }
  };

  // Filtered Jira Issues
  const filteredJiraIssues = tasks.filter((issue: any) => {
    if (jiraSearch.trim()) {
      const q = jiraSearch.trim().toLowerCase();
      const matchTitle = issue.title?.toLowerCase().includes(q);
      const matchKey = issue.issueKey?.toLowerCase().includes(q);
      const matchDesc = issue.description?.toLowerCase().includes(q);
      const matchLabels = issue.labels?.some((l: string) => l.toLowerCase().includes(q));
      if (!matchTitle && !matchKey && !matchDesc && !matchLabels) return false;
    }

    if (jiraTypeFilter !== 'all' && issue.issueType !== jiraTypeFilter) {
      return false;
    }

    if (jiraPriorityFilter !== 'all' && issue.priority !== jiraPriorityFilter) {
      return false;
    }

    if (jiraAssigneeFilter === 'my') {
      const myId = (user as any)?._id || (user as any)?.id;
      const assignedId = issue.assignedTo?._id || issue.assignedTo;
      if (assignedId !== myId) return false;
    } else if (jiraAssigneeFilter !== 'all') {
      const assignedId = issue.assignedTo?._id || issue.assignedTo;
      if (assignedId !== jiraAssigneeFilter) return false;
    }

    return true;
  });

  // Assignable members pool
  const assignableMembers = React.useMemo(() => {
    const list: any[] = [];
    if (project?.assignedMembers) {
      project.assignedMembers.forEach((m: any) => {
        if (m.user && !list.some((u) => u._id === m.user._id)) {
          list.push({ ...m.user, role: m.roleInProject || m.user.role });
        }
      });
    }
    allUsers.forEach((u: any) => {
      if (!list.some((existing) => existing._id === u._id)) {
        list.push(u);
      }
    });
    return list;
  }, [project, allUsers]);

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

  // Scope document upload (supports multiple documents)
  const handleUploadScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeFile) return;

    setUploadingScope(true);
    const formData = new FormData();
    formData.append('scopeFile', scopeFile);
    formData.append('title', scopeTitle.trim() || scopeFile.name);
    formData.append('summary', scopeSummary);

    try {
      const res = await apiUpload(`/projects/${projectId}/scope`, formData);
      if (res.success) {
        setScopeFile(null);
        setScopeTitle('');
        setScopeSummary('');
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingScope(false);
    }
  };

  // Delete a specific scope document
  const handleDeleteScope = async (scopeId: string) => {
    if (!confirm('Are you sure you want to delete this scope document?')) return;
    try {
      setDeletingScopeId(scopeId);
      const res = await apiDelete(`/projects/${projectId}/scope/${scopeId}`);
      if (res.success) {
        fetchProjectData();
      }
    } catch (err) {
      console.error('Failed to delete scope document:', err);
    } finally {
      setDeletingScopeId(null);
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

  // Update member allocation in project
  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    const editUserId = editingMember.user?._id || editingMember.user;
    const currentMembers = project.assignedMembers || [];
    const updated = currentMembers.map((m: any) => {
      const mUserId = m.user?._id || m.user;
      if (mUserId === editUserId) {
        return {
          user: editUserId,
          roleInProject: editingMember.roleInProject,
          allocatedHoursPerWeek: Number(editingMember.allocatedHoursPerWeek),
        };
      }
      return {
        user: mUserId,
        roleInProject: m.roleInProject,
        allocatedHoursPerWeek: m.allocatedHoursPerWeek,
      };
    });

    try {
      const res = await apiPut(`/projects/${projectId}/resources`, { assignedMembers: updated });
      if (res.success) {
        setEditingMember(null);
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Remove member from project
  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName || 'this member'} from the project squad?`)) return;

    const currentMembers = project.assignedMembers || [];
    const updated = currentMembers
      .filter((m: any) => (m.user?._id || m.user) !== userId)
      .map((m: any) => ({
        user: m.user?._id || m.user,
        roleInProject: m.roleInProject,
        allocatedHoursPerWeek: m.allocatedHoursPerWeek,
      }));

    try {
      const res = await apiPut(`/projects/${projectId}/resources`, { assignedMembers: updated });
      if (res.success) {
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update time log
  const handleUpdateTimeLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimeLog) return;
    try {
      const res = await apiPut(`/tasks/timelogs/${editingTimeLog._id}`, {
        hours: Number(editingTimeLog.hours),
        description: editingTimeLog.description,
        billable: editingTimeLog.billable,
        date: editingTimeLog.date,
      });
      if (res.success) {
        setEditingTimeLog(null);
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete time log
  const handleDeleteTimeLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this work log entry?')) return;
    try {
      const res = await apiDelete(`/tasks/timelogs/${logId}`);
      if (res.success) {
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

              {canManageProjects && (
                <button
                  onClick={() => setShowEditProjectModal(true)}
                  className="px-3 py-1 rounded-xl text-xs font-semibold bg-[#161F30] hover:bg-[#5470F4] text-gray-200 hover:text-white border border-[#1F293D] hover:border-[#5470F4] transition-all flex items-center gap-1.5 shadow-sm"
                  title="Edit Project Name & Details"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#5CC5FA]" />
                  <span>Edit Project</span>
                </button>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {project.title}
            </h1>
            <p className="text-xs text-gray-400 max-w-3xl leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-4 sm:gap-6 bg-[#0B0F19] p-4 rounded-2xl border border-[#1F293D] self-start lg:self-auto">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Completion</span>
              <span className="text-2xl font-black text-white">{project.completionPercentage || 0}%</span>
            </div>
            <div className="border-l border-[#1F293D] pl-4 sm:pl-6">
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
          { id: 'jira', label: 'Jira Workspace', icon: LayoutGrid, count: tasks.length },
          {
            id: 'scope',
            label: 'Project Scope & Specs',
            icon: FileText,
            count: project.scopeDocuments?.length
              ? `${project.scopeDocuments.length} Specs`
              : (project.scopeDocument?.fileUrl ? '1 Spec' : null),
          },
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

      {/* Tab 0: Jira Workspace (Kanban Board, Backlog, Roadmap) */}
      {activeTab === 'jira' && (
        <div className="space-y-6">
          {/* Sub-view switcher & Global Jira filters bar */}
          <div className="bg-[#111827] border border-[#1F293D] p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* View Mode Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-[#0B0F19] rounded-2xl border border-[#1F293D]">
              <button
                onClick={() => setJiraSubView('board')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  jiraSubView === 'board'
                    ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kanban Board</span>
              </button>

              <button
                onClick={() => setJiraSubView('backlog')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  jiraSubView === 'backlog'
                    ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Backlog</span>
              </button>

              <button
                onClick={() => setJiraSubView('roadmap')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  jiraSubView === 'roadmap'
                    ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Roadmap</span>
              </button>
            </div>

            {/* Filter and Search Actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search issues..."
                  value={jiraSearch}
                  onChange={(e) => setJiraSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 rounded-xl bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] text-xs text-white placeholder:text-gray-500 outline-none w-36 sm:w-44"
                />
              </div>

              {/* Type Filter */}
              <select
                value={jiraTypeFilter}
                onChange={(e) => setJiraTypeFilter(e.target.value)}
                className="text-xs font-semibold px-2.5 py-2 rounded-xl bg-[#0B0F19] border border-[#1F293D] text-gray-300 focus:border-[#5470F4] outline-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="story">Story 📗</option>
                <option value="task">Task 📘</option>
                <option value="bug">Bug 🔴</option>
                <option value="epic">Epic 🟪</option>
              </select>

              {/* "Only My Issues" toggle */}
              <button
                onClick={() => setJiraAssigneeFilter(jiraAssigneeFilter === 'my' ? 'all' : 'my')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  jiraAssigneeFilter === 'my'
                    ? 'bg-[#5470F4]/20 border-[#5470F4] text-[#5CC5FA]'
                    : 'bg-[#0B0F19] border-[#1F293D] text-gray-400 hover:text-white'
                }`}
              >
                Only My Issues
              </button>

              {/* Priority Filter */}
              <select
                value={jiraPriorityFilter}
                onChange={(e) => setJiraPriorityFilter(e.target.value)}
                className="text-xs font-semibold px-2.5 py-2 rounded-xl bg-[#0B0F19] border border-[#1F293D] text-gray-300 focus:border-[#5470F4] outline-none cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Lowest">Lowest</option>
              </select>

              {/* Create Issue Action */}
              <button
                onClick={() => {
                  setCreateIssueDefaultStatus('todo');
                  setShowCreateIssueModal(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold gradient-btn text-white flex items-center gap-1.5 shadow-md shadow-[#5470F4]/20 hover:scale-[1.02] transition-all ml-auto sm:ml-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Issue</span>
              </button>
            </div>
          </div>

          {/* Sub-view render */}
          {jiraSubView === 'board' && (
            <JiraBoard
              issues={filteredJiraIssues}
              onSelectIssue={setSelectedIssue}
              onMoveStatus={handleMoveStatus}
              onOpenCreateModal={(colStatus) => {
                setCreateIssueDefaultStatus(colStatus || 'todo');
                setShowCreateIssueModal(true);
              }}
            />
          )}

          {jiraSubView === 'backlog' && (
            <JiraBacklog
              issues={filteredJiraIssues}
              onSelectIssue={setSelectedIssue}
              onMoveStatus={handleMoveStatus}
              onQuickCreate={handleQuickCreateIssue}
            />
          )}

          {jiraSubView === 'roadmap' && (
            <JiraRoadmap
              issues={filteredJiraIssues}
              onSelectIssue={setSelectedIssue}
            />
          )}
        </div>
      )}

      {/* Tab 1: Project Scope & Specs */}
      {activeTab === 'scope' && (() => {
        const scopeDocsList = (project.scopeDocuments && project.scopeDocuments.length > 0)
          ? project.scopeDocuments
          : (project.scopeDocument?.fileName ? [project.scopeDocument] : []);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Attached Scope Documents Card */}
              <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F293D] pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#5470F4]" />
                      <span>Project Scope & Specifications</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Authorized deliverable specifications, contractual requirements & architecture outlines.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {scopeDocsList.length} {scopeDocsList.length === 1 ? 'Specification Document' : 'Specification Documents'}
                    </span>
                  </div>
                </div>

                {scopeDocsList.length > 0 ? (
                  <div className="space-y-4">
                    {scopeDocsList.map((doc: any, index: number) => {
                      const docId = doc._id || `scope-${index}`;
                      const isDeleting = deletingScopeId === docId;
                      const isPdf = (doc.fileType?.includes('pdf') || doc.fileName?.toLowerCase().endsWith('.pdf'));
                      const isWord = (doc.fileType?.includes('word') || doc.fileName?.toLowerCase().endsWith('.doc') || doc.fileName?.toLowerCase().endsWith('.docx'));

                      return (
                        <div
                          key={docId}
                          className="bg-[#161F30] border border-[#1F293D] hover:border-[#5470F4]/40 rounded-2xl p-5 space-y-4 transition-all"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                              <div
                                className={`p-3 rounded-xl border flex-shrink-0 ${
                                  isPdf
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : isWord
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                }`}
                              >
                                <FileText className="w-6 h-6" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-bold text-white">
                                    {doc.title || doc.originalName || doc.fileName}
                                  </h4>
                                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#0B0F19] border border-[#1F293D] text-gray-400">
                                    {isPdf ? 'PDF' : isWord ? 'DOCX' : 'DOCUMENT'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 font-mono break-all">
                                  {doc.originalName || doc.fileName}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                                  <span>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                  {doc.fileSize ? (
                                    <span>• {(doc.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                                  ) : null}
                                  {doc.uploadedBy?.name && (
                                    <span>• By {doc.uploadedBy.name}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-start flex-shrink-0">
                              <a
                                href={`${BASE_URL}${doc.fileUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2 rounded-xl text-xs font-semibold gradient-btn text-white flex items-center gap-1.5 shadow-md shadow-[#5470F4]/20 hover:scale-[1.02] transition-all"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>View / Download</span>
                              </a>

                              {hasRole('CEO', 'Project Manager') && (
                                <button
                                  onClick={() => handleDeleteScope(docId)}
                                  disabled={isDeleting}
                                  className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-[#1F293D] hover:border-rose-500/30 transition-all disabled:opacity-50"
                                  title="Delete document"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {doc.summary && (
                            <div className="border-t border-[#1F293D] pt-3">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                                Scope Summary & Objectives:
                              </span>
                              <p className="text-xs text-gray-300 leading-relaxed bg-[#0B0F19] p-3 rounded-xl border border-[#1F293D]">
                                {doc.summary}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-10 text-center bg-[#161F30]/40 rounded-2xl border border-dashed border-[#1F293D] space-y-2">
                    <FileText className="w-10 h-10 text-gray-500 mx-auto" />
                    <p className="text-xs font-semibold text-white">No scope documents attached yet</p>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      Attach signed project specifications, architecture blueprints, or contracts using the upload form.
                    </p>
                  </div>
                )}
              </div>

              {/* Scope Deliverables & Key Objectives */}
              <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-white">Deliverable Standards & Objectives</h3>
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
                    <span>Attach Scope Document</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Upload technical specifications, contracts, or architecture blueprints.</p>
                </div>

                <form onSubmit={handleUploadScope} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Document Title / Label <span className="text-gray-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={scopeTitle}
                      onChange={(e) => setScopeTitle(e.target.value)}
                      placeholder="e.g., Technical Architecture Spec v2.0"
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-2.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div className="border-2 border-dashed border-[#1F293D] hover:border-[#5470F4] rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      required
                      onChange={(e) => setScopeFile(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-xs font-bold text-white block truncate px-2">
                      {scopeFile ? scopeFile.name : 'Click to select document'}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-1 block">PDF, DOC, DOCX up to 15MB</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Version Notes / Summary</label>
                    <textarea
                      rows={3}
                      value={scopeSummary}
                      onChange={(e) => setScopeSummary(e.target.value)}
                      placeholder="Brief summary of deliverables or changes..."
                      className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingScope || !scopeFile}
                    className="w-full py-2.5 rounded-xl text-xs font-bold gradient-btn text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-[#5470F4]/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{uploadingScope ? 'Uploading Document...' : 'Attach Scope Document'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        );
      })()}

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
                    className="p-5 rounded-2xl bg-[#161F30] border border-[#1F293D] flex flex-col justify-between gap-3 shadow-md group relative hover:border-[#5470F4]/40 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center font-black text-sm text-[#5CC5FA] shadow-sm shrink-0">
                            {u.name ? u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">{u.name}</h4>
                            <p className="text-[11px] text-[#5CC5FA] font-medium truncate">{member.roleInProject}</p>
                          </div>
                        </div>

                        {canManageProjects && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() =>
                                setEditingMember({
                                  user: u,
                                  roleInProject: member.roleInProject,
                                  allocatedHoursPerWeek: member.allocatedHoursPerWeek || 20,
                                })
                              }
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1E293D] transition-colors"
                              title="Edit Member Role & Hours"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#5CC5FA]" />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(u._id, u.name)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Remove Member from Project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-[#1F293D] pt-3 flex items-center justify-between text-xs">
                        <span className="text-gray-400">Committed Workload</span>
                        <span className="font-bold text-white bg-[#0B0F19] px-2.5 py-1 rounded-lg border border-[#1F293D]">
                          {member.allocatedHoursPerWeek || 20} hrs/week
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-500 pt-1 border-t border-[#1F293D]/50 flex items-center justify-between">
                      <span className="truncate">{u.department} • {u.designation}</span>
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
                timeLogs.map((log: any) => {
                  const currentUserId = (user as any)?._id || (user as any)?.id;
                  const logUserId = log.user?._id || log.user;
                  const canModifyLog = canManageProjects || logUserId === currentUserId;

                  return (
                    <div
                      key={log._id}
                      className="p-4 rounded-2xl bg-[#161F30]/60 border border-[#1F293D] flex items-start justify-between gap-4 group hover:border-[#5470F4]/30 transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/30 flex items-center justify-center font-bold text-xs text-[#5CC5FA] shrink-0">
                          {log.user?.name ? log.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{log.user?.name}</h5>
                          <p className="text-xs text-gray-300 mt-1">{log.description}</p>
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            {new Date(log.date).toLocaleDateString()} • {log.billable ? 'Billable' : 'Non-billable'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-[#5CC5FA] bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#1F293D]">
                          {log.hours} hrs
                        </span>

                        {canModifyLog && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setEditingTimeLog({
                                  _id: log._id,
                                  hours: log.hours,
                                  description: log.description,
                                  billable: log.billable ?? true,
                                  date: log.date ? new Date(log.date).toISOString().split('T')[0] : '',
                                })
                              }
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1E293D] transition-colors"
                              title="Edit Time Log"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#5CC5FA]" />
                            </button>
                            <button
                              onClick={() => handleDeleteTimeLog(log._id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete Time Log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
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

      {/* Edit Resource Allocation Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#5CC5FA]" />
                <span>Edit Squad Allocation</span>
              </h3>
              <button
                onClick={() => setEditingMember(null)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Assigned Employee</label>
                <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1F293D] text-xs text-white font-semibold flex items-center justify-between">
                  <span>{editingMember.user?.name}</span>
                  <span className="text-[10px] text-gray-400">{editingMember.user?.department}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Role in this Project</label>
                <input
                  type="text"
                  required
                  value={editingMember.roleInProject}
                  onChange={(e) => setEditingMember({ ...editingMember, roleInProject: e.target.value })}
                  placeholder="e.g. Lead Engineer, UI Designer, QA Specialist"
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Allocated Hours per Week</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={80}
                  value={editingMember.allocatedHoursPerWeek}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, allocatedHoursPerWeek: Number(e.target.value) })
                  }
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Time Log Modal */}
      {editingTimeLog && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#5CC5FA]" />
                <span>Edit Work Hours Log</span>
              </h3>
              <button
                onClick={() => setEditingTimeLog(null)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTimeLog} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Hours Spent</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  required
                  value={editingTimeLog.hours}
                  onChange={(e) => setEditingTimeLog({ ...editingTimeLog, hours: Number(e.target.value) })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={editingTimeLog.date}
                  onChange={(e) => setEditingTimeLog({ ...editingTimeLog, date: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Work Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What was completed during this block?"
                  value={editingTimeLog.description}
                  onChange={(e) => setEditingTimeLog({ ...editingTimeLog, description: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-billable"
                  checked={editingTimeLog.billable}
                  onChange={(e) => setEditingTimeLog({ ...editingTimeLog, billable: e.target.checked })}
                  className="rounded accent-[#5470F4]"
                />
                <label htmlFor="edit-billable" className="text-xs text-gray-300 font-semibold cursor-pointer">
                  Mark as Billable Hours
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setEditingTimeLog(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Jira Issue Detail Slide-Over Modal */}
      {selectedIssue && (
        <JiraIssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdateIssue={handleUpdateIssue}
          onDeleteIssue={handleDeleteIssue}
          teamMembers={assignableMembers}
        />
      )}

      {/* Jira Create Issue Modal */}
      {showCreateIssueModal && (
        <CreateIssueModal
          projectId={projectId}
          projectCode={project.code}
          defaultStatus={createIssueDefaultStatus}
          onClose={() => setShowCreateIssueModal(false)}
          onCreated={(newIssue) => {
            setTasks((prev) => [newIssue, ...prev]);
          }}
          teamMembers={assignableMembers}
        />
      )}
      {/* Edit Project Modal */}
      {showEditProjectModal && (
        <EditProjectModal
          isOpen={showEditProjectModal}
          project={project}
          onClose={() => setShowEditProjectModal(false)}
          onUpdated={(updated) => {
            setProject((prev: any) => ({ ...prev, ...updated }));
          }}
        />
      )}
    </div>
  );
}
