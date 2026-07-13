'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  WizardNavigationState,
  WizardProviderProps,
  WizardStepDefinition,
  WizardVariant,
} from './types';

function isStepHidden<TContext>(
  step: WizardStepDefinition<TContext>,
  context: TContext,
): boolean {
  if (typeof step.hidden === 'function') return step.hidden(context);
  return Boolean(step.hidden);
}

function buildNavigationState<TContext>(
  visibleSteps: WizardStepDefinition<TContext>[],
  currentStepIndex: number,
  completedStepIds: Set<string>,
  visitedStepIds: Set<string>,
): WizardNavigationState {
  const current = visibleSteps[currentStepIndex];
  const count = visibleSteps.length || 1;
  return {
    currentStepIndex,
    currentStepId: current?.id ?? '',
    completedStepIds: Array.from(completedStepIds),
    visitedStepIds: Array.from(visitedStepIds),
    visibleStepCount: visibleSteps.length,
    progressPercent: Math.round(((currentStepIndex + 1) / count) * 100),
  };
}

export interface WizardContextValue<TContext = unknown> {
  steps: WizardStepDefinition<TContext>[];
  visibleSteps: WizardStepDefinition<TContext>[];
  context: TContext;
  readOnly: boolean;
  variant: WizardVariant;
  currentStepIndex: number;
  currentStep: WizardStepDefinition<TContext> | undefined;
  completedStepIds: Set<string>;
  visitedStepIds: Set<string>;
  navigation: WizardNavigationState;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
  isFirstStep: boolean;
  canJumpToStep: (index: number) => boolean;
  goToStep: (index: number) => void;
  goPrevious: () => void;
  goNext: () => Promise<boolean>;
  markStepCompleted: (stepId: string) => void;
}

const WizardContext = createContext<WizardContextValue<unknown> | null>(null);

export function WizardProvider<TContext>({
  steps,
  context,
  readOnly = false,
  variant = 'mobile',
  initialStepId,
  resetKey,
  keyboardNavigation = true,
  onStepChange,
  onAutoSave,
  children,
}: WizardProviderProps<TContext>) {
  const visibleSteps = useMemo(
    () => steps.filter((step) => !isStepHidden(step, context)),
    [steps, context],
  );

  const resolveInitialIndex = useCallback(() => {
    if (!visibleSteps.length) return 0;
    if (initialStepId) {
      const idx = visibleSteps.findIndex((s) => s.id === initialStepId);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [initialStepId, visibleSteps]);

  const [currentStepIndex, setCurrentStepIndex] = useState(resolveInitialIndex);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set());
  const [visitedStepIds, setVisitedStepIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const first = visibleSteps[resolveInitialIndex()];
    if (first) initial.add(first.id);
    return initial;
  });

  const resetTokenRef = useRef(resetKey);

  useEffect(() => {
    if (resetTokenRef.current === resetKey) return;
    resetTokenRef.current = resetKey;
    const index = resolveInitialIndex();
    setCurrentStepIndex(index);
    setCompletedStepIds(new Set());
    const visited = new Set<string>();
    const step = visibleSteps[index];
    if (step) visited.add(step.id);
    setVisitedStepIds(visited);
  }, [resetKey, resolveInitialIndex, visibleSteps]);

  useEffect(() => {
    if (currentStepIndex >= visibleSteps.length) {
      setCurrentStepIndex(Math.max(0, visibleSteps.length - 1));
    }
  }, [currentStepIndex, visibleSteps.length]);

  const currentStep = visibleSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === Math.max(0, visibleSteps.length - 1);

  const navigation = useMemo(
    () => buildNavigationState(visibleSteps, currentStepIndex, completedStepIds, visitedStepIds),
    [visibleSteps, currentStepIndex, completedStepIds, visitedStepIds],
  );

  const emitStepChange = useCallback(
    (next: WizardNavigationState) => {
      onStepChange?.(next);
      onAutoSave?.(next);
    },
    [onAutoSave, onStepChange],
  );

  const markStepCompleted = useCallback((stepId: string) => {
    setCompletedStepIds((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);

  const canJumpToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= visibleSteps.length) return false;
      if (index <= currentStepIndex) return true;
      const step = visibleSteps[index];
      return completedStepIds.has(step.id) || visitedStepIds.has(step.id);
    },
    [completedStepIds, currentStepIndex, visitedStepIds, visibleSteps],
  );

  const goToStep = useCallback(
    (index: number) => {
      if (!canJumpToStep(index)) return;
      const step = visibleSteps[index];
      if (!step) return;
      setCurrentStepIndex(index);
      setVisitedStepIds((prev) => {
        if (prev.has(step.id)) return prev;
        const next = new Set(prev);
        next.add(step.id);
        return next;
      });
      emitStepChange(
        buildNavigationState(
          visibleSteps,
          index,
          completedStepIds,
          new Set([...visitedStepIds, step.id]),
        ),
      );
    },
    [canJumpToStep, completedStepIds, emitStepChange, visitedStepIds, visibleSteps],
  );

  const goPrevious = useCallback(() => {
    goToStep(currentStepIndex - 1);
  }, [currentStepIndex, goToStep]);

  const goNext = useCallback(async () => {
    const step = visibleSteps[currentStepIndex];
    if (!step) return false;

    if (step.validate) {
      const valid = await step.validate(context);
      if (!valid && !step.canSkip && !step.optional) return false;
    }

    markStepCompleted(step.id);

    if (isLastStep) {
      emitStepChange(
        buildNavigationState(
          visibleSteps,
          currentStepIndex,
          new Set([...completedStepIds, step.id]),
          visitedStepIds,
        ),
      );
      return true;
    }

    const nextIndex = currentStepIndex + 1;
    const nextStep = visibleSteps[nextIndex];
    setCurrentStepIndex(nextIndex);
    setVisitedStepIds((prev) => {
      const next = new Set(prev);
      if (nextStep) next.add(nextStep.id);
      return next;
    });
    emitStepChange(
      buildNavigationState(
        visibleSteps,
        nextIndex,
        new Set([...completedStepIds, step.id]),
        nextStep ? new Set([...visitedStepIds, nextStep.id]) : visitedStepIds,
      ),
    );
    return true;
  }, [
    completedStepIds,
    context,
    currentStepIndex,
    emitStepChange,
    isLastStep,
    markStepCompleted,
    visitedStepIds,
    visibleSteps,
  ]);

  useEffect(() => {
    if (!keyboardNavigation) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (!isFirstStep) goPrevious();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (!isLastStep) void goNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrevious, isFirstStep, isLastStep, keyboardNavigation]);

  const value = useMemo<WizardContextValue<TContext>>(
    () => ({
      steps,
      visibleSteps,
      context,
      readOnly,
      variant,
      currentStepIndex,
      currentStep,
      completedStepIds,
      visitedStepIds,
      navigation,
      canGoPrevious: !isFirstStep,
      canGoNext: !isLastStep,
      isLastStep,
      isFirstStep,
      canJumpToStep,
      goToStep,
      goPrevious,
      goNext,
      markStepCompleted,
    }),
    [
      steps,
      visibleSteps,
      context,
      readOnly,
      variant,
      currentStepIndex,
      currentStep,
      completedStepIds,
      visitedStepIds,
      navigation,
      isFirstStep,
      isLastStep,
      canJumpToStep,
      goToStep,
      goPrevious,
      goNext,
      markStepCompleted,
    ],
  );

  return <WizardContext.Provider value={value as WizardContextValue<unknown>}>{children}</WizardContext.Provider>;
}

export function useWizard<TContext = unknown>(): WizardContextValue<TContext> {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return ctx as WizardContextValue<TContext>;
}
