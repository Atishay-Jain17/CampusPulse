export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type IssueCategory =
  | 'wifi'
  | 'classroom_equipment'
  | 'maintenance'
  | 'electrical'
  | 'plumbing'
  | 'security'
  | 'lost_found'
  | 'other';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  location: string;
  priority: IssuePriority;
  status: IssueStatus;
  reporterName?: string;
  createdAt: string;
  updatedAt: string;
  isDemoData?: boolean;
}

export interface CreateIssuePayload {
  title: string;
  description: string;
  category: IssueCategory;
  location: string;
  priority: IssuePriority;
  reporterName?: string;
}

export interface IssueFilters {
  status?: IssueStatus;
  category?: IssueCategory;
  priority?: IssuePriority;
}

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  wifi: 'Wi-Fi / Network',
  classroom_equipment: 'Classroom Equipment',
  maintenance: 'Maintenance',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  security: 'Security',
  lost_found: 'Lost & Found',
  other: 'Other',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};
