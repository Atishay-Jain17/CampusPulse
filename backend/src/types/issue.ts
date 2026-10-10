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

export interface CreateIssueInput {
  title: string;
  description: string;
  category: IssueCategory;
  location: string;
  priority: IssuePriority;
  reporterName?: string;
}

export interface UpdateIssueInput {
  status: IssueStatus;
}

export const VALID_STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
export const VALID_CATEGORIES: IssueCategory[] = [
  'wifi',
  'classroom_equipment',
  'maintenance',
  'electrical',
  'plumbing',
  'security',
  'lost_found',
  'other',
];
export const VALID_PRIORITIES: IssuePriority[] = ['low', 'medium', 'high', 'critical'];
