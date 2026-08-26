import type { ComponentType, ReactNode } from 'react';

export type WizardVariant = 'mobile' | 'desktop';

export interface WizardStepComponentProps<TContext = unknown, TMeta = unknown> {
  context: TContext;
  meta?: TMeta;
  stepId: string;
  readOnly?: boolean;
  variant?: WizardVariant;
}

export interface WizardStepLockArgs<TContext = unknown> {
  context: TContext;
  visitedStepIds: Set<string>;
  completedStepIds: Set<string>;
}

export interface WizardStepDefinition<TContext = unknown, TMeta = unknown> {
  id: string;
  title: string;
  description?: string;
  component: ComponentType<WizardStepComponentProps<TContext, TMeta>>;
  optional?: boolean;
  hidden?: boolean | ((context: TContext) => boolean);
  /** When true, step is visible but not reachable until prerequisites are met. */
  locked?: boolean | ((args: WizardStepLockArgs<TContext>) => boolean);
  getLockMessage?: (args: WizardStepLockArgs<TContext>) => string | null;
  validate?: (context: TContext) => boolean | Promise<boolean>;
  canSkip?: boolean;
  meta?: TMeta;
}

export interface WizardNavigationState {
  currentStepIndex: number;
  currentStepId: string;
  completedStepIds: string[];
  visitedStepIds: string[];
  visibleStepCount: number;
  progressPercent: number;
}

export interface WizardProviderProps<TContext> {
  steps: WizardStepDefinition<TContext>[];
  context: TContext;
  readOnly?: boolean;
  variant?: WizardVariant;
  initialStepId?: string;
  /** Restore visited step ids from persisted diagnostic progress. */
  initialVisitedStepIds?: string[];
  resetKey?: string | number;
  keyboardNavigation?: boolean;
  onStepChange?: (state: WizardNavigationState) => void;
  onAutoSave?: (state: WizardNavigationState) => void;
  children: ReactNode;
}

export interface WizardNavigationProps {
  onComplete?: () => void;
  completeLabel?: string;
  isCompleting?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
}

export interface WizardProgressProps {
  className?: string;
}

export interface WizardHeaderProps {
  title?: string;
  description?: string;
  className?: string;
}

export interface WizardFooterProps {
  children?: ReactNode;
  className?: string;
}

export interface WizardProps<TContext> extends WizardProviderProps<TContext>, WizardNavigationProps {
  headerTitle?: string;
  headerDescription?: string;
  footerExtra?: ReactNode;
  className?: string;
}
