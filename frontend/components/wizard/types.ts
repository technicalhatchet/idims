import type { ComponentType, ReactNode } from 'react';

export type WizardVariant = 'mobile' | 'desktop';

export interface WizardStepComponentProps<TContext = unknown, TMeta = unknown> {
  context: TContext;
  meta?: TMeta;
  stepId: string;
  readOnly?: boolean;
  variant?: WizardVariant;
}

export interface WizardStepDefinition<TContext = unknown, TMeta = unknown> {
  id: string;
  title: string;
  description?: string;
  component: ComponentType<WizardStepComponentProps<TContext, TMeta>>;
  optional?: boolean;
  hidden?: boolean | ((context: TContext) => boolean);
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
