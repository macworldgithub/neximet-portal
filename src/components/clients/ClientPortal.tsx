'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, CheckCircle2, Download, FileText, FolderKanban, MessageSquare, Plus, RefreshCw, Video, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL, apiGet, apiPatch, apiPost, getToken } from '../../lib/api';

type Client = { _id: string; name: string; email: string; company: string; billingAddress: string; phone: string; isActive: boolean };
type Project = { _id: string; title: string; code: string; client?: string; status: string; completionPercentage: number; deadline: string; totalTasks: number; doneTasks: number; taskProgress: number; milestones: { _id: string; title: string; status: string; progress: number; deadline: string }[] };
type Task = { _id: string; title: string; description: string; status: string; priority: string; deadline?: string; clientVisible: boolean; clientRequested: boolean; assignedTo?: { _id: string; name: string } | null };
type Item = { description: string; quantity: number; rate: number; amount?: number };
type Invoice = { _id: string; number: string; client: string; currency: string; issuedAt: string; dueAt: string; status: string; subtotal: number; taxRate: number; tax: number; total: number; items: Item[]; billTo: { name: string; company: string; email: string; address: string }; notes: string; paymentDetails: string };
const input = 'min-w-0 w-full rounded-xl border border-[#29334a] bg-[#0B0F19] px-3 py-2.5 text-sm text-white outline-none focus:border-[#728cff]';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#29334a] bg-[#161f30] px-4 py-2.5 text-sm font-medium hover:border-[#728cff] disabled:opacity-40';
const panel = 'rounded-2xl border border-[#253047] bg-[#111827] p-5 sm:p-6';
const statuses = ['backlog', 'todo', 'in_progress', 'review', 'done'];
const label = (value: string) => value.replaceAll('_', ' ');
const date = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'No due date';
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const today = () => new Date().toLocaleDateString('en-CA');

function Field({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) { return <label className={`grid min-w-0 gap-2 text-xs font-medium text-gray-400 ${className}`}>{title}{children}</label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const dialog = document.getElementById('portal-dialog'); dialog?.querySelector<HTMLElement>('button, input, select')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section id="portal-dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, a[href]')).filter(node => node.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }} className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#29334a] bg-[#111827] p-5 sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close dialog"><X size={20} /></button></div>{children}
    </section>
  </div>;
}

export default function ClientPortal({ finance = false, management = false }: { finance?: boolean; management?: boolean }) {
  const { user, isSuperAdmin } = useAuth();
  const [tab, setTab] = useState(finance ? 'finance' : 'projects');
  const [clients, setClients] = useState<Client[]>([]), [projects, setProjects] = useState<Project[]>([]), [invoices, setInvoices] = useState<Invoice[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState(''), [projectId, setProjectId] = useState('');
  const [taskResult, setTaskResult] = useState<{ projectId: string; items: Task[] } | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'client' | 'task' | 'invoice' | null>(null), [preview, setPreview] = useState<Invoice | null>(null), [editingClient, setEditingClient] = useState<Client | null>(null);
  const [notice, setNotice] = useState('');
  const canManage = management && isSuperAdmin;
  const allowed = canManage || (!management && user?.role === 'Client');
  const load = useCallback(async () => {
    if (!allowed) return;
    const results = await Promise.all([apiGet('/portal/projects'), apiGet('/portal/invoices'), ...(canManage ? [apiGet('/portal/clients'), apiGet('/auth/users')] : [])]);
    const failed = results.find(result => !result.success);
    if (failed) setError(failed.message || 'Unable to load portal.');
    else { setError(''); setProjects(results[0].projects); setInvoices(results[1].invoices); if (canManage) { setClients(results[2].clients); setEmployees(results[3].users.filter((person: { isActive: boolean; role: string }) => person.isActive && person.role !== 'Client')); } }
    setLoading(false);
  }, [allowed, canManage]);
  // Initial data is committed only after the API response.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!allowed) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => clearInterval(timer);
  }, [allowed, load]);
  const visibleProjects = canManage ? projects.filter(project => !clientId || project.client === clientId) : projects;
  const selected = visibleProjects.find(project => project._id === projectId) || visibleProjects[0];
  const selectedId = selected?._id;
  const tasks = taskResult && taskResult.projectId === selectedId ? taskResult.items : [];
  const tasksLoading = !!selectedId && taskResult?.projectId !== selectedId;
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void apiGet(`/portal/projects/${selectedId}/tasks`).then(result => {
      if (!active) return;
      setTaskResult({ projectId: selectedId, items: result.success ? result.tasks : [] });
      if (!result.success) setError(result.message || 'Unable to load tasks.');
    });
    return () => { active = false; };
  }, [selectedId, projects]);
  async function mutate(endpoint: string, body: unknown, method: 'post' | 'patch' = 'post') {
    setBusy(true); setError(''); setNotice('');
    const result = await (method === 'post' ? apiPost(endpoint, body) : apiPatch(endpoint, body));
    setBusy(false);
    if (!result.success) { setError(result.message || 'Unable to save.'); return false; }
    setNotice('Saved successfully.'); await load(); return true;
  }
  async function download(invoice: Invoice) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API_URL}/portal/invoices/${invoice._id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!response.ok) throw new Error('Unable to download invoice. Please retry.');
      const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a'); anchor.href = url; anchor.download = `${invoice.number}.pdf`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Download failed.'); }
    finally { setBusy(false); }
  }
  if (!allowed) return <p className="p-8 text-gray-400">This portal is available to clients and authorized administrators.</p>;
  const visibleInvoices = canManage && clientId ? invoices.filter(invoice => invoice.client === clientId) : invoices;
  const totals = visibleProjects.reduce((sum, project) => ({ total: sum.total + project.totalTasks, done: sum.done + project.doneTasks }), { total: 0, done: 0 });
  return <div className="space-y-6 pb-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8d9fff]">Neximet · {canManage ? 'Client management' : 'Client portal'}</p><h1 className="text-3xl font-bold tracking-tight">{canManage ? 'Clients & Finance' : finance ? 'Your finances' : `Welcome, ${user?.name.split(' ')[0]}`}</h1><p className="mt-2 text-sm text-gray-400">{canManage ? 'Manage client accounts, coordinate delivery, and issue invoices.' : 'Your projects, conversations, and invoices in one place.'}</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => void load()} aria-label="Refresh portal" className={button}><RefreshCw size={16} /></button><Link className={button} href="/chat"><MessageSquare size={16} />Chat</Link><Link className={button} href="/meet"><Video size={16} />Meet</Link></div>
    </header>
    {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}<button className="ml-3 underline" onClick={() => void load()}>Retry</button></div>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {canManage && <div className="flex flex-wrap items-center gap-3"><label className="text-sm text-gray-400" htmlFor="portal-client">View client</label><select id="portal-client" className={`${input} max-w-sm`} value={clientId} onChange={event => { setClientId(event.target.value); setProjectId(''); }}><option value="">All clients & unlinked projects</option>{clients.map(client => <option key={client._id} value={client._id}>{client.company || client.name}{!client.isActive ? ' (inactive)' : ''}</option>)}</select><button className={button} onClick={() => { setEditingClient(null); setModal('client'); }}><Plus size={16} />Create client</button></div>}
    <nav aria-label="Portal tabs" className="flex gap-2 overflow-x-auto border-b border-[#253047] pb-3">
      {(canManage ? ['projects', 'accounts', 'finance'] : ['projects', 'finance']).map(item => canManage ? <button key={item} onClick={() => setTab(item)} className={`${button} capitalize ${tab === item ? 'border-[#728cff] text-[#9daeff]' : 'text-gray-400'}`}>{item}</button> : <Link key={item} href={item === 'finance' ? '/client/finance' : '/client'} className={`${button} capitalize ${(finance ? 'finance' : 'projects') === item ? 'border-[#728cff] text-[#9daeff]' : 'text-gray-400'}`}>{item === 'projects' ? 'Overview & tasks' : 'Finance'}</Link>)}
    </nav>
    {loading && !projects.length && !clients.length && !invoices.length ? <p role="status" className="py-12 text-center text-gray-400">Loading portal…</p> : <>
      {tab === 'accounts' && canManage && <div className="grid gap-4 md:grid-cols-2">{clients.length ? clients.map(client => <article key={client._id} className={panel}><div className="flex items-start justify-between gap-3"><Building2 className="text-[#9daeff]" size={26} /><span className={`text-xs ${client.isActive ? 'text-emerald-300' : 'text-gray-500'}`}>{client.isActive ? 'Active' : 'Inactive'}</span></div><h2 className="mt-4 font-semibold">{client.company || client.name}</h2><p className="mt-1 text-sm text-gray-400">{client.name} · {client.email}</p><p className="mt-2 whitespace-pre-wrap text-xs text-gray-500">{client.billingAddress}</p><div className="mt-5 flex flex-wrap gap-2"><button className={button} onClick={() => { setEditingClient(client); setModal('client'); }}>Edit details</button><button disabled={busy} className={button} onClick={() => void mutate(`/portal/clients/${client._id}`, { isActive: !client.isActive }, 'patch')}>{client.isActive ? 'Deactivate' : 'Activate'}</button><button className={button} onClick={() => { setClientId(client._id); setTab('projects'); }}>Projects</button></div></article>) : <Empty text="Create your first client account to get started." />}</div>}
      {tab === 'projects' && <>
        <div className="grid gap-4 sm:grid-cols-3">{[{ title: 'Projects', value: visibleProjects.length, icon: FolderKanban }, { title: 'Tasks completed', value: `${totals.done} / ${totals.total}`, icon: CheckCircle2 }, { title: 'Open invoices', value: visibleInvoices.filter(invoice => invoice.status === 'issued').length, icon: FileText }].map(stat => <div key={stat.title} className={panel}><stat.icon className="mb-4 text-[#8d9fff]" size={22} /><p className="text-2xl font-semibold">{stat.value}</p><p className="mt-1 text-xs text-gray-400">{stat.title}</p></div>)}</div>
        {!visibleProjects.length ? <Empty text={canManage ? 'No projects for this client. Create a project in Projects & Scopes, then link it here.' : 'Your projects will appear here when Neximet links them to your account.'} /> : <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleProjects.map(project => <button key={project._id} onClick={() => setProjectId(project._id)} aria-pressed={selectedId === project._id} className={`${panel} text-left ${selectedId === project._id ? 'border-[#728cff]' : 'hover:border-gray-500'}`}><div className="flex items-center justify-between gap-2 text-xs"><span className="font-mono text-[#9daeff]">{project.code}</span><span className="capitalize text-gray-400">{label(project.status)}</span></div><h2 className="mt-3 font-semibold">{project.title}</h2><div className="mt-5 flex justify-between text-xs text-gray-400"><span>Project progress</span><span>{project.completionPercentage}%</span></div><div role="progressbar" aria-label={`${project.title} progress`} aria-valuenow={project.completionPercentage} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-2 overflow-hidden rounded-full bg-[#253047]"><div className="h-full rounded-full bg-gradient-to-r from-[#5470F4] to-[#5CC5FA]" style={{ width: `${project.completionPercentage}%` }} /></div><p className="mt-4 text-xs text-gray-400">{project.doneTasks} of {project.totalTasks} shared tasks completed · Due {date(project.deadline)}</p></button>)}</div>
          {selected && <section className={`${panel} space-y-5`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{selected.title}</h2><p className="mt-1 text-xs text-gray-400">{canManage ? 'Assign work and choose which tasks the client can see.' : 'Assign a task to Neximet and follow its delivery here.'}</p></div><button className={button} onClick={() => setModal('task')}><Plus size={16} />{canManage ? 'Add shared task' : 'Assign task to Neximet'}</button></div>
            {canManage && <div className="flex flex-wrap items-end gap-3"><Field title="Linked client"><select className={input} disabled={busy} value={selected.client || ''} onChange={event => void mutate(`/portal/projects/${selected._id}/client`, { clientId: event.target.value }, 'patch')}><option value="">Unlinked (private to staff)</option>{clients.map(client => <option key={client._id} value={client._id}>{client.company || client.name}</option>)}</select></Field><Link className={button} href={`/projects/${selected._id}`}>Open internal project</Link></div>}
            {!!selected.milestones?.length && <div className="grid gap-3 sm:grid-cols-2">{selected.milestones.map(milestone => <div key={milestone._id} className="rounded-xl bg-[#0B0F19] p-4"><p className="text-sm font-medium">{milestone.title}</p><p className="mt-2 text-xs capitalize text-gray-400">{label(milestone.status)} · {milestone.progress}% · {date(milestone.deadline)}</p></div>)}</div>}
            {tasksLoading ? <p role="status" className="text-sm text-gray-400">Loading tasks…</p> : !tasks.length ? <Empty text="No tasks yet. Add a task to begin." /> : <div className="space-y-3">{tasks.map(task => <article key={task._id} className="rounded-xl border border-[#253047] bg-[#0B0F19] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{task.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-400">{task.description}</p><p className="mt-3 text-xs text-gray-500">{task.priority} priority · {date(task.deadline)}{task.clientRequested ? ' · Client request' : ''}</p></div><span className={`rounded-full px-3 py-1 text-xs capitalize ${['done', 'completed'].includes(task.status) ? 'bg-emerald-500/10 text-emerald-300' : 'bg-[#5470F4]/15 text-[#9daeff]'}`}>{label(task.status)}</span></div>{canManage && <div className="mt-4 flex flex-wrap items-end gap-3"><Field title="Internal assignee"><select disabled={busy} className={input} value={task.assignedTo?._id || ''} onChange={event => void mutate(`/portal/tasks/${task._id}`, { assignedTo: event.target.value }, 'patch')}><option value="">Unassigned</option>{employees.map(person => <option key={person._id} value={person._id}>{person.name}</option>)}</select></Field><Field title="Status"><select disabled={busy} className={input} value={task.status} onChange={event => void mutate(`/portal/tasks/${task._id}`, { status: event.target.value }, 'patch')}>{statuses.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></Field><label className="flex items-center gap-2 py-3 text-xs text-gray-400"><input type="checkbox" checked={task.clientVisible} disabled={busy} onChange={event => void mutate(`/portal/tasks/${task._id}`, { clientVisible: event.target.checked }, 'patch')} />Visible to client</label></div>}</article>)}</div>}
          </section>}
        </>}
      </>}
      {tab === 'finance' && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Invoices</h2><p className="mt-1 text-sm text-gray-400">Issued invoices, payment details, and downloadable PDFs.</p></div>{canManage && <button className={button} onClick={() => setModal('invoice')}><Plus size={16} />Create invoice</button>}</div>{!visibleInvoices.length ? <Empty text="No invoices yet. Issued invoices will appear here." /> : <div className="grid gap-4 md:grid-cols-2">{visibleInvoices.map(invoice => <article key={invoice._id} className={panel}><div className="flex items-center justify-between gap-3"><FileText className="text-[#9daeff]" size={24} /><span className={`rounded-full px-3 py-1 text-xs capitalize ${invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-[#253047] text-gray-300'}`}>{invoice.status === 'issued' && new Date(invoice.dueAt).toISOString().slice(0, 10) < today() ? 'Overdue' : invoice.status}</span></div><h3 className="mt-4 font-mono text-sm">{invoice.number}</h3><p className="mt-1 text-xs text-gray-400">{invoice.billTo.company || invoice.billTo.name}</p><p className="mt-4 text-2xl font-semibold">{money(invoice.total, invoice.currency)}</p><p className="mt-2 text-xs text-gray-400">Issued {date(invoice.issuedAt)} · Due {date(invoice.dueAt)}</p><div className="mt-5 flex flex-wrap gap-2"><button className={button} onClick={() => setPreview(invoice)}>View invoice</button><button disabled={busy} className={button} onClick={() => void download(invoice)}><Download size={15} />PDF</button>{canManage && <select aria-label={`Status for ${invoice.number}`} disabled={busy} value={invoice.status} onChange={event => void mutate(`/portal/invoices/${invoice._id}`, { status: event.target.value }, 'patch')} className={`${input} w-auto`}>{['issued', 'paid', 'void'].map(status => <option key={status}>{status}</option>)}</select>}</div></article>)}</div>}</section>}
    </>}
    {modal && <Modal title={modal === 'client' ? editingClient ? 'Edit client' : 'Create client account' : modal === 'task' ? 'Assign a task to Neximet' : 'Create invoice'} onClose={() => { if (!busy) { setModal(null); setError(''); } }}>
      {error && <p role="alert" className="mb-4 text-sm text-rose-300">{error}</p>}
      {modal === 'client' && <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); const form = new FormData(event.currentTarget), body = Object.fromEntries(form.entries());
        if (await mutate(editingClient ? `/portal/clients/${editingClient._id}` : '/portal/clients', body, editingClient ? 'patch' : 'post')) setModal(null);
      }}><div className="grid gap-4 sm:grid-cols-2"><Field title="Contact name"><input required maxLength={160} name="name" defaultValue={editingClient?.name} className={input} /></Field><Field title="Company"><input name="company" maxLength={160} defaultValue={editingClient?.company} className={input} /></Field><Field title="Email"><input type="email" required name="email" disabled={!!editingClient} defaultValue={editingClient?.email} className={input} /></Field><Field title="Phone"><input name="phone" maxLength={80} defaultValue={editingClient?.phone} className={input} /></Field></div><Field title="Billing address"><textarea name="billingAddress" maxLength={1000} defaultValue={editingClient?.billingAddress} className={input} rows={3} /></Field>{!editingClient && <><Field title="Initial password"><input type="password" required minLength={8} maxLength={128} autoComplete="new-password" name="password" className={input} /></Field><p className="text-xs text-gray-400">Share the login email and initial password with the client securely. They can change their password in Profile settings.</p></>}<button className={`${button} bg-[#5470F4]`} disabled={busy}>{busy ? 'Saving…' : editingClient ? 'Save client' : 'Create account'}</button></form>}
      {modal === 'task' && selected && <form className="space-y-4" onSubmit={async event => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); if (await mutate(`/portal/projects/${selected._id}/tasks`, body)) { setModal(null); } }}><p className="text-sm text-[#9daeff]">{selected.title}</p><Field title="Task title"><input required name="title" maxLength={200} className={input} /></Field><Field title="Description"><textarea name="description" maxLength={10000} rows={5} className={input} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field title="Priority"><select name="priority" defaultValue="Medium" className={input}>{['Lowest', 'Low', 'Medium', 'High', 'Urgent'].map(value => <option key={value}>{value}</option>)}</select></Field><Field title="Requested due date"><input type="date" name="deadline" className={input} /></Field></div><button className={`${button} bg-[#5470F4]`} disabled={busy}>{busy ? 'Submitting…' : 'Submit task'}</button></form>}
      {modal === 'invoice' && <InvoiceForm clients={clients} projects={projects} clientId={clientId} busy={busy} onSave={async body => { if (await mutate('/portal/invoices', body)) setModal(null); }} />}
    </Modal>}
    {preview && <Modal title="Invoice details" onClose={() => setPreview(null)}><InvoicePreview invoice={preview} /><button disabled={busy} className={`${button} mt-6`} onClick={() => void download(preview)}><Download size={16} />Download PDF</button></Modal>}
  </div>;
}

function Empty({ text }: { text: string }) { return <div className={`${panel} py-12 text-center text-sm text-gray-400`}>{text}</div>; }
function InvoiceForm({ clients, projects, clientId, busy, onSave }: { clients: Client[]; projects: Project[]; clientId: string; busy: boolean; onSave: (body: unknown) => Promise<void> }) {
  const [owner, setOwner] = useState(clientId), [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, rate: 0 }]), [taxRate, setTaxRate] = useState(0), [currency, setCurrency] = useState('PKR');
  const subtotal = roundMoney(items.reduce((sum, item) => sum + roundMoney(item.quantity * item.rate), 0)), tax = roundMoney(subtotal * taxRate / 100);
  const change = (index: number, key: keyof Item, value: string | number) => setItems(current => current.map((item, position) => index === position ? { ...item, [key]: value } : item));
  return <form className="space-y-5" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void onSave({ ...Object.fromEntries(form), clientId: owner, currency, items, taxRate }); }}>
    <div className="grid gap-4 sm:grid-cols-2"><Field title="Client"><select required value={owner} onChange={event => setOwner(event.target.value)} className={input}><option value="">Choose client</option>{clients.filter(client => client.isActive).map(client => <option key={client._id} value={client._id}>{client.company || client.name}</option>)}</select></Field><Field title="Project (optional)"><select key={owner} name="projectId" className={input}><option value="">General invoice</option>{projects.filter(project => project.client === owner).map(project => <option key={project._id} value={project._id}>{project.title}</option>)}</select></Field><Field title="Issue date"><input type="date" required name="issuedAt" defaultValue={today()} className={input} /></Field><Field title="Due date"><input type="date" required name="dueAt" defaultValue={today()} className={input} /></Field><Field title="Currency"><select value={currency} onChange={event => setCurrency(event.target.value)} className={input}>{['PKR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD'].map(value => <option key={value}>{value}</option>)}</select></Field><Field title="Tax rate (%)"><input type="number" min={0} max={100} step="0.01" required value={taxRate} onChange={event => setTaxRate(Number(event.target.value))} className={input} /></Field></div>
    <div className="space-y-3">{items.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] sm:grid-cols-[minmax(0,1fr)_70px_100px_32px] items-end gap-2"><Field title="Description" className="col-span-3 sm:col-span-1"><input aria-label={`Item ${index + 1} description`} required maxLength={300} value={item.description} onChange={event => change(index, 'description', event.target.value)} className={input} /></Field><Field title="Qty"><input aria-label={`Item ${index + 1} quantity`} type="number" required min="0.01" max="100000" step="0.01" value={item.quantity} onChange={event => change(index, 'quantity', Number(event.target.value))} className={input} /></Field><Field title="Rate"><input aria-label={`Item ${index + 1} rate`} type="number" required min={0} max={100000000} step="0.01" value={item.rate} onChange={event => change(index, 'rate', Number(event.target.value))} className={input} /></Field><button type="button" disabled={items.length === 1} aria-label={`Remove item ${index + 1}`} onClick={() => setItems(items.filter((_, position) => position !== index))} className="pb-3 text-gray-400 disabled:opacity-25"><X size={18} /></button></div>)}<button type="button" disabled={items.length >= 50} className={button} onClick={() => setItems([...items, { description: '', quantity: 1, rate: 0 }])}><Plus size={15} />Add line item</button></div>
    <div className="rounded-xl bg-[#0B0F19] p-4 text-right text-sm"><p className="text-gray-400">Subtotal {money(subtotal, currency)} · Tax {money(tax, currency)}</p><p className="mt-2 text-xl font-semibold">Total {money(subtotal + tax, currency)}</p></div>
    <Field title="Payment details"><textarea name="paymentDetails" maxLength={2000} rows={3} placeholder="Bank account, payment reference, and payment instructions" className={input} /></Field><Field title="Notes"><textarea name="notes" maxLength={2000} rows={2} className={input} /></Field><p className="text-xs text-gray-400">Issuing makes this invoice available immediately in the selected client’s Finance tab.</p><button disabled={busy} className={`${button} bg-[#5470F4]`}>{busy ? 'Issuing…' : 'Issue invoice'}</button>
  </form>;
}
function InvoicePreview({ invoice }: { invoice: Invoice }) {
  return <div className="rounded-xl bg-white p-5 text-gray-900 sm:p-8"><div className="-mx-5 -mt-5 mb-7 flex flex-wrap items-center justify-between gap-4 rounded-t-xl bg-[#111827] p-5 sm:-mx-8 sm:-mt-8 sm:p-8"><img src="/neximet-logo.avif" alt="Neximet" className="h-9 w-auto" /><div className="text-right"><p className="text-xl font-semibold text-white">INVOICE</p><p className="mt-1 text-xs text-indigo-200">{invoice.number}</p></div></div><div className="flex flex-wrap justify-between gap-5 text-sm"><div><p className="text-xs text-gray-500">BILL TO</p><p className="mt-2 font-semibold">{invoice.billTo.company || invoice.billTo.name}</p><p>{invoice.billTo.name}</p><p>{invoice.billTo.email}</p><p className="whitespace-pre-wrap">{invoice.billTo.address}</p></div><div><p>Issued: {date(invoice.issuedAt)}</p><p>Due: {date(invoice.dueAt)}</p><p className="mt-1 capitalize">Status: {invoice.status}</p></div></div><div className="my-6 overflow-x-auto"><table className="w-full min-w-[430px] text-left text-sm"><thead className="bg-indigo-50"><tr><th className="p-2">Description</th><th className="whitespace-nowrap p-2">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={index} className="border-b border-gray-200"><td className="max-w-64 whitespace-pre-wrap break-words p-2">{item.description}</td><td className="p-2">{item.quantity}</td><td className="whitespace-nowrap p-2 text-right">{money(item.rate, invoice.currency)}</td><td className="whitespace-nowrap p-2 text-right">{money(item.amount || 0, invoice.currency)}</td></tr>)}</tbody></table></div><div className="space-y-2 text-right text-sm"><p>Subtotal: {money(invoice.subtotal, invoice.currency)}</p><p>Tax ({invoice.taxRate}%): {money(invoice.tax, invoice.currency)}</p><p className="rounded-lg bg-indigo-50 p-3 text-lg font-semibold">Total: {money(invoice.total, invoice.currency)}</p></div>{invoice.paymentDetails && <div className="mt-6"><h3 className="text-xs font-semibold text-gray-500">PAYMENT DETAILS</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{invoice.paymentDetails}</p></div>}{invoice.notes && <p className="mt-6 whitespace-pre-wrap break-words text-sm text-gray-600">{invoice.notes}</p>}</div>;
}
