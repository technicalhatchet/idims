export type LogitType = 'problem' | 'idea' | 'blocker' | 'positive';

export type LogitCategory =
  | 'scheduling'
  | 'job_details'
  | 'diagnostics'
  | 'parts'
  | 'documentation'
  | 'photos'
  | 'customer'
  | 'performance'
  | 'ui_ux'
  | 'other';

export type LogitSeverity = 'minor' | 'moderate' | 'major' | 'critical' | 'not_applicable';

export type LogitFrequency = 'once' | 'occasional' | 'frequent' | 'every_time' | 'unknown' | 'not_applicable';

export type LogitStatus = 'draft' | 'logged';

export type LogitClassification = {
  type: LogitType;
  category: LogitCategory;
  severity: LogitSeverity;
  frequency: LogitFrequency;
  title: string;
  description: string;
  impact: string;
  suggested_fix: string;
  confidence: number;
};

export type LogitProject = {
  id: string;
  name: string;
  context?: string | null;
  icon?: string | null;
  created_at: string;
  updated_at: string;
  entry_count?: number;
  unreviewed_count?: number;
};

export type LogitEntry = {
  id: string;
  project_id: string;
  created_at: string;
  type?: LogitType | null;
  category?: LogitCategory | null;
  severity?: LogitSeverity | null;
  frequency?: LogitFrequency | null;
  title?: string | null;
  description?: string | null;
  impact?: string | null;
  suggested_fix?: string | null;
  original_transcript: string;
  ai_confidence?: number | null;
  ai_model?: string | null;
  status: LogitStatus;
  resolved_at?: string | null;
};
