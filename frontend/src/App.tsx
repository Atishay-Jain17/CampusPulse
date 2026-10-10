import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Wifi,
  Wrench,
  Zap,
  BookOpen,
  Shield,
  Package,
  HelpCircle,
  ChevronLeft,
  X,
  Activity,
  MapPin,
  User,
  Calendar,
} from 'lucide-react';
import type {
  Issue,
  IssueCategory,
  IssuePriority,
  IssueStatus,
  CreateIssuePayload,
} from './types';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from './types';
import {
  fetchIssues,
  fetchIssue,
  createIssue,
  updateIssueStatus,
  checkHealth,
} from './api';

// ─── BADGE HELPERS ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<IssueStatus, string> = {
  open: 'bg-red-500/20 text-red-300 border border-red-500/30',
  in_progress: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  resolved: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  closed: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
};

const PRIORITY_COLORS: Record<IssuePriority, string> = {
  low: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  critical: 'bg-red-600/30 text-red-200 border border-red-600/40',
};

const CATEGORY_ICONS: Record<IssueCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  wifi: Wifi,
  classroom_equipment: BookOpen,
  maintenance: Wrench,
  electrical: Zap,
  plumbing: Activity,
  security: Shield,
  lost_found: Package,
  other: HelpCircle,
};

function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: IssuePriority }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function CategoryIcon({ category, size = 16 }: { category: IssueCategory; size?: number }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} className="text-slate-400" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── TOAST NOTIFICATION ──────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

function ToastList({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm animate-in fade-in ${
            t.type === 'success' ? 'bg-emerald-900 border border-emerald-700 text-emerald-100' :
            t.type === 'error' ? 'bg-red-900 border border-red-700 text-red-100' :
            'bg-slate-700 border border-slate-600 text-slate-100'
          }`}
        >
          {t.type === 'success' ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> :
           t.type === 'error' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> :
           <Activity size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── API STATUS BANNER ───────────────────────────────────────────────────────

function ApiStatusBanner({ connected }: { connected: boolean | null }) {
  if (connected === true) return null;
  if (connected === null) return (
    <div className="bg-slate-700/50 border-b border-slate-600 px-4 py-2 text-sm text-slate-300 flex items-center gap-2">
      <Loader2 size={14} className="animate-spin" /> Connecting to CampusPulse API…
    </div>
  );
  return (
    <div className="bg-red-900/40 border-b border-red-800 px-4 py-2 text-sm text-red-300 flex items-center gap-2">
      <AlertTriangle size={14} /> API unavailable — set VITE_API_BASE_URL and rebuild to connect
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, onClick,
}: {
  label: string; value: number | string; icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-slate-800 border border-slate-700 rounded-xl p-5 text-left w-full hover:border-slate-600 transition-colors ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg bg-slate-700/50`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </button>
  );
}

// ─── ISSUE CARD (list view) ───────────────────────────────────────────────────

function IssueCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-slate-500 hover:bg-slate-750 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 p-1.5 bg-slate-700 rounded-lg shrink-0">
            <CategoryIcon category={issue.category} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-100 group-hover:text-white truncate">
              {issue.title}
              {issue.isDemoData && (
                <span className="ml-2 text-xs text-slate-500 font-normal">[Demo]</span>
              )}
            </p>
            <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">{issue.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><MapPin size={11} />{issue.location}</span>
              <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(issue.createdAt)}</span>
              {issue.reporterName && (
                <span className="flex items-center gap-1"><User size={11} />{issue.reporterName}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
        </div>
      </div>
    </button>
  );
}

// ─── ISSUE DETAIL VIEW ────────────────────────────────────────────────────────

function IssueDetail({
  issueId,
  onBack,
  onToast,
  apiConnected,
}: {
  issueId: string;
  onBack: () => void;
  onToast: (msg: string, type: Toast['type']) => void;
  apiConnected: boolean | null;
}) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [newStatus, setNewStatus] = useState<IssueStatus>('open');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetchIssue(issueId);
      if (res.error) setError(res.error);
      else {
        setIssue(res.data);
        setNewStatus(res.data?.status || 'open');
      }
      setLoading(false);
    })();
  }, [issueId]);

  const handleUpdate = async () => {
    if (!issue || !adminToken.trim()) {
      onToast('Enter the administrator token to update status.', 'error');
      return;
    }
    setUpdating(true);
    const res = await updateIssueStatus(issue.id, newStatus, adminToken);
    if (res.error) {
      onToast(`Update failed: ${res.error}`, 'error');
    } else {
      setIssue(res.data);
      onToast('Issue status updated successfully!', 'success');
      setShowAdminPanel(false);
      setAdminToken('');
    }
    setUpdating(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={32} className="animate-spin text-amber-400" />
    </div>
  );

  if (error || !issue) return (
    <div className="text-center py-20">
      <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
      <p className="text-slate-300 text-lg">{error || 'Issue not found'}</p>
      <button onClick={onBack} className="mt-4 text-amber-400 hover:text-amber-300 text-sm">
        ← Back to issues
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors"
      >
        <ChevronLeft size={16} /> Back to issues
      </button>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-700 rounded-lg mt-0.5">
              <CategoryIcon category={issue.category} size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {issue.title}
                {issue.isDemoData && (
                  <span className="ml-2 text-sm text-slate-500 font-normal">[Demo Data]</span>
                )}
              </h2>
              <p className="text-slate-400 text-sm mt-1">{CATEGORY_LABELS[issue.category]}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
          </div>
        </div>

        <div className="prose prose-invert max-w-none mb-6">
          <p className="text-slate-300 leading-relaxed">{issue.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-700/40 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1"><MapPin size={11} />Location</p>
            <p className="text-slate-200 text-sm">{issue.location}</p>
          </div>
          {issue.reporterName && (
            <div className="bg-slate-700/40 rounded-lg p-3">
              <p className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1"><User size={11} />Reported by</p>
              <p className="text-slate-200 text-sm">{issue.reporterName}</p>
            </div>
          )}
          <div className="bg-slate-700/40 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1"><Calendar size={11} />Created</p>
            <p className="text-slate-200 text-sm">{formatDateTime(issue.createdAt)}</p>
          </div>
          <div className="bg-slate-700/40 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1"><Clock size={11} />Last updated</p>
            <p className="text-slate-200 text-sm">{formatDateTime(issue.updatedAt)}</p>
          </div>
        </div>

        {/* Admin Panel */}
        {apiConnected && (
          <div className="border-t border-slate-700 pt-5">
            {!showAdminPanel ? (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="flex items-center gap-2 text-slate-400 hover:text-amber-300 text-sm transition-colors"
              >
                <Settings size={15} /> Update status (Administrator)
              </button>
            ) : (
              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <Shield size={15} className="text-amber-400" /> Administrator Action
                  </p>
                  <button onClick={() => setShowAdminPanel(false)} className="text-slate-500 hover:text-slate-300">
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">New Status</label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as IssueStatus)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Admin Token</label>
                    <input
                      type="password"
                      value={adminToken}
                      onChange={e => setAdminToken(e.target.value)}
                      placeholder="Enter admin token"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <button
                  onClick={handleUpdate}
                  disabled={updating || !adminToken.trim()}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {updating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Update Status
                </button>
                <p className="text-xs text-slate-500 mt-2">
                  The admin token is set via the ADMIN_TOKEN environment variable on the Lambda function.
                  It is never stored in the frontend bundle.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── REPORT FORM ─────────────────────────────────────────────────────────────

const CATEGORIES: { value: IssueCategory; label: string }[] = [
  { value: 'wifi', label: 'Wi-Fi / Network' },
  { value: 'classroom_equipment', label: 'Classroom Equipment' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'security', label: 'Security' },
  { value: 'lost_found', label: 'Lost & Found' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES: { value: IssuePriority; label: string }[] = [
  { value: 'low', label: 'Low — Not urgent' },
  { value: 'medium', label: 'Medium — Affects some students' },
  { value: 'high', label: 'High — Significant disruption' },
  { value: 'critical', label: 'Critical — Safety or widespread impact' },
];

interface FormState {
  title: string;
  description: string;
  category: IssueCategory | '';
  location: string;
  priority: IssuePriority | '';
  reporterName: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  location?: string;
  priority?: string;
}

function ReportForm({
  onSuccess,
  onToast,
}: {
  onSuccess: (issue: Issue) => void;
  onToast: (msg: string, type: Toast['type']) => void;
}) {
  const [form, setForm] = useState<FormState>({
    title: '', description: '', category: '', location: '', priority: '', reporterName: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.title.trim() || form.title.trim().length < 3)
      newErrors.title = 'Title must be at least 3 characters';
    if (form.title.trim().length > 200)
      newErrors.title = 'Title must be at most 200 characters';
    if (!form.description.trim() || form.description.trim().length < 10)
      newErrors.description = 'Description must be at least 10 characters';
    if (!form.category)
      newErrors.category = 'Select a category';
    if (!form.location.trim() || form.location.trim().length < 2)
      newErrors.location = 'Location must be at least 2 characters';
    if (!form.priority)
      newErrors.priority = 'Select a priority level';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const payload: CreateIssuePayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category as IssueCategory,
      location: form.location.trim(),
      priority: form.priority as IssuePriority,
      reporterName: form.reporterName.trim() || undefined,
    };

    const res = await createIssue(payload);
    if (res.error) {
      onToast(`Failed to submit: ${res.error}`, 'error');
    } else if (res.data) {
      onToast('Issue submitted successfully!', 'success');
      setForm({ title: '', description: '', category: '', location: '', priority: '', reporterName: '' });
      setErrors({});
      onSuccess(res.data);
    }
    setSubmitting(false);
  };

  const field = (name: keyof FormState) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [name]: e.target.value })),
  });

  const inputClass = (err?: string) =>
    `w-full bg-slate-800 border ${err ? 'border-red-500' : 'border-slate-600'} rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 placeholder:text-slate-600 transition-colors`;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-1">Report a Campus Issue</h2>
        <p className="text-slate-400 text-sm mb-6">Help us keep campus running. All fields except name are required.</p>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Issue Title *</label>
            <input {...field('title')} type="text" placeholder="e.g. Projector not working in CS101" className={inputClass(errors.title)} />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Category *</label>
              <select {...field('category')} className={inputClass(errors.category)}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.category && <p className="text-red-400 text-xs mt-1">{errors.category}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority *</label>
              <select {...field('priority')} className={inputClass(errors.priority)}>
                <option value="">Select priority…</option>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {errors.priority && <p className="text-red-400 text-xs mt-1">{errors.priority}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Campus Location *</label>
            <input {...field('location')} type="text" placeholder="e.g. Engineering Block B - Room 204" className={inputClass(errors.location)} />
            {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description *</label>
            <textarea
              {...field('description')}
              rows={4}
              placeholder="Describe the issue in detail. What's happening? When did it start? How does it affect you?"
              className={inputClass(errors.description)}
            />
            <div className="flex justify-between mt-1">
              {errors.description ? <p className="text-red-400 text-xs">{errors.description}</p> : <span />}
              <p className="text-slate-600 text-xs">{form.description.length}/2000</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Name <span className="text-slate-500 font-normal">(optional)</span></label>
            <input {...field('reporterName')} type="text" placeholder="e.g. Alex Chen" className={inputClass()} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-bold text-sm py-3 px-6 rounded-lg transition-colors"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {submitting ? 'Submitting…' : 'Submit Issue Report'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── ISSUES LIST VIEW ─────────────────────────────────────────────────────────

function IssuesList({
  onSelectIssue,
}: {
  onSelectIssue: (id: string) => void;
}) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchIssues({
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      priority: priorityFilter || undefined,
    });
    if (res.error) setError(res.error);
    else setIssues(res.data || []);
    setLoading(false);
  }, [statusFilter, categoryFilter, priorityFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = issues.filter(i =>
    !search.trim() ||
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.description.toLowerCase().includes(search.toLowerCase()) ||
    i.location.toLowerCase().includes(search.toLowerCase())
  );

  const selectClass = "bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500";

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search issues…"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as IssueStatus | '')} className={selectClass}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as IssueCategory | '')} className={selectClass}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as IssuePriority | '')} className={selectClass}>
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          onClick={load}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-sm px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-amber-400" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-300">{error}</p>
          <button onClick={load} className="mt-3 text-amber-400 hover:text-amber-300 text-sm">Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <FileText size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">No issues found</p>
          <p className="text-slate-500 text-sm mt-1">
            {search ? 'Try adjusting your search or filters' : 'No issues have been reported yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-slate-500 text-sm">{filtered.length} issue{filtered.length !== 1 ? 's' : ''} found</p>
          {filtered.map(issue => (
            <IssueCard key={issue.id} issue={issue} onClick={() => onSelectIssue(issue.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD OVERVIEW ───────────────────────────────────────────────────────

function Dashboard({
  onNavigate,
}: {
  onNavigate: (view: string, filter?: string) => void;
}) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetchIssues();
      if (res.error) setError(res.error);
      else setIssues(res.data || []);
      setLoading(false);
    })();
  }, []);

  const total = issues.length;
  const open = issues.filter(i => i.status === 'open').length;
  const inProgress = issues.filter(i => i.status === 'in_progress').length;
  const resolved = issues.filter(i => i.status === 'resolved').length;
  const recent = issues.slice(0, 5);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={32} className="animate-spin text-amber-400" />
    </div>
  );

  if (error) return (
    <div className="text-center py-20">
      <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
      <p className="text-slate-300">{error}</p>
      <p className="text-slate-500 text-sm mt-2">Ensure VITE_API_BASE_URL points to your deployed API</p>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Campus Overview</h2>
        <p className="text-slate-400 text-sm mt-1">Live issue tracking across all campus facilities</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Reports" value={total} icon={FileText} color="text-slate-200" onClick={() => onNavigate('issues')} />
        <StatCard label="Open" value={open} icon={AlertTriangle} color="text-red-300" onClick={() => onNavigate('issues', 'open')} />
        <StatCard label="In Progress" value={inProgress} icon={Clock} color="text-amber-300" onClick={() => onNavigate('issues', 'in_progress')} />
        <StatCard label="Resolved" value={resolved} icon={CheckCircle} color="text-emerald-300" onClick={() => onNavigate('issues', 'resolved')} />
      </div>

      {/* Recent Issues */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200">Recent Reports</h3>
        <button
          onClick={() => onNavigate('issues')}
          className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          View all →
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
          <FileText size={36} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">No issues reported yet</p>
          <p className="text-slate-500 text-sm mt-1">Campus is all clear — or use the seed script to load demo data.</p>
          <button
            onClick={() => onNavigate('report')}
            className="mt-4 flex items-center gap-2 mx-auto bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Submit first report
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {recent.map(issue => (
            <IssueCard key={issue.id} issue={issue} onClick={() => onNavigate('issue', issue.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'report' | 'issues' | 'issue';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);

  // Check API health on load
  useEffect(() => {
    (async () => {
      const res = await checkHealth();
      setApiConnected(res.error === null);
    })();
  }, []);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const navigate = (newView: string, param?: string) => {
    if (newView === 'issue') {
      setSelectedIssueId(param || null);
      setView('issue');
    } else {
      setView(newView as View);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'report', label: 'Report Issue', icon: Plus },
    { id: 'issues', label: 'Browse Issues', icon: Filter },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <ToastList toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-slate-900" />
            </div>
            <div>
              <span className="font-bold text-white text-lg leading-none">CampusPulse</span>
              <span className="text-slate-400 text-xs block leading-none mt-0.5">Issue Tracker</span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${apiConnected === true ? 'bg-emerald-400' : apiConnected === false ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-xs text-slate-500 hidden sm:inline">
              {apiConnected === true ? 'API Live' : apiConnected === false ? 'API Offline' : 'Connecting…'}
            </span>
          </div>
        </div>
      </header>

      <ApiStatusBanner connected={apiConnected} />

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === 'dashboard' && (
          <Dashboard onNavigate={navigate} />
        )}
        {view === 'report' && (
          <ReportForm
            onSuccess={issue => { navigate('issue', issue.id); }}
            onToast={addToast}
          />
        )}
        {view === 'issues' && (
          <IssuesList onSelectIssue={id => navigate('issue', id)} />
        )}
        {view === 'issue' && selectedIssueId && (
          <IssueDetail
            issueId={selectedIssueId}
            onBack={() => navigate('issues')}
            onToast={addToast}
            apiConnected={apiConnected}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-16 py-6 px-4 text-center">
        <p className="text-slate-600 text-sm">
          CampusPulse — AWS Cloud Innovation Challenge |{' '}
          <span className="text-slate-500">Powered by Lambda · DynamoDB · API Gateway · S3</span>
        </p>
      </footer>
    </div>
  );
}
