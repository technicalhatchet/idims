import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useLogitSpeech } from '../../hooks/useLogitSpeech';
import {
  classifyLogitObservation,
  createLogitEntry,
  createLogitProject,
  deleteLogitProject,
  deleteLogitEntry,
  fetchLogitEntries,
  fetchLogitProjects,
  updateLogitEntry,
  updateLogitProject,
} from '../../services/api/logitApi';
import {
  createLocalId,
  getLastProjectId,
  removeLocalDraft,
  removePendingSave,
  saveLocalDraft,
  savePendingSave,
  setLastProjectId,
} from './logitStorage';
import { LOGIT_CANVAS } from './logitUi';
import LogitTypeCapture from './LogitTypeCapture';
import LogitTypeSelect from './LogitTypeSelect';
import LogitEntryDetail from './LogitEntryDetail';
import LogitEntryList from './LogitEntryList';
import LogitProcessing from './LogitProcessing';
import LogitProjectList from './LogitProjectList';
import LogitReview from './LogitReview';
import LogitTranscriptPreview from './LogitTranscriptPreview';
import LogitInstallHint, { useLogitInstallHint } from './LogitInstallHint';
import {
  logitCapturePath,
  logitEntryPath,
  logitLogPath,
  logitProjectsPath,
  logitReviewPath,
  logitTranscriptPath,
  logitTypeCapturePath,
  parseLogitSlug,
} from './logitRoutes';

export default function LogitApp() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useUser();
  const speech = useLogitSpeech();
  const installHint = useLogitInstallHint();

  const route = useMemo(() => parseLogitSlug(router.query.slug), [router.query.slug]);
  const screen = route.screen;

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const [transcript, setTranscript] = useState('');
  const [classification, setClassification] = useState(null);
  const [aiMeta, setAiMeta] = useState({ model: null, source: null });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [localDraftId, setLocalDraftId] = useState(null);
  const [selectedObservationType, setSelectedObservationType] = useState(null);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [resolvingEntry, setResolvingEntry] = useState(false);
  const hasAutoOpenedRef = useRef(false);

  const navigate = useCallback((path, { replace = false } = {}) => {
    if (replace) {
      void router.replace(path);
    } else {
      void router.push(path);
    }
  }, [router]);

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const data = await fetchLogitProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjectsError('Could not load projects. Check your connection and try again.');
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const refreshEntries = useCallback(async (projectId) => {
    if (!projectId) return;
    setEntriesLoading(true);
    try {
      const data = await fetchLogitEntries(projectId);
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshProjects();
  }, [user, refreshProjects]);

  useEffect(() => {
    if (!router.isReady || !user || projectsLoading || projects.length === 0 || hasAutoOpenedRef.current) {
      return;
    }
    if (screen !== 'projects') return;

    const lastId = getLastProjectId();
    const lastProject = projects.find((p) => p.id === lastId);
    if (lastProject) {
      hasAutoOpenedRef.current = true;
      navigate(logitCapturePath(lastProject.id), { replace: true });
    }
  }, [user, projects, projectsLoading, screen, router.isReady, navigate]);

  useEffect(() => {
    if (!route.projectId || projects.length === 0) {
      setActiveProject(null);
      return;
    }
    const project = projects.find((p) => p.id === route.projectId);
    setActiveProject(project || null);
    if (project) {
      setLastProjectId(project.id);
      refreshEntries(project.id);
    }
  }, [route.projectId, projects, refreshEntries]);

  useEffect(() => {
    if (route.observationType) {
      setSelectedObservationType(route.observationType);
    }
  }, [route.observationType]);

  useEffect(() => {
    if (screen !== 'entry' || !route.entryId) {
      setSelectedEntry(null);
      return;
    }
    const entry = entries.find((item) => item.id === route.entryId);
    if (entry) {
      setSelectedEntry(entry);
      return;
    }
    if (!entriesLoading) {
      setSelectedEntry(null);
    }
  }, [screen, route.entryId, entries, entriesLoading]);

  const unreviewedCount = useMemo(() => {
    if (activeProject?.unreviewed_count != null) return activeProject.unreviewed_count;
    return entries.filter((e) => e.status === 'draft').length;
  }, [activeProject, entries]);

  const selectProject = (project) => {
    setLastProjectId(project.id);
    speech.resetTranscript();
    setTranscript('');
    setClassification(null);
    setSelectedObservationType(null);
    setEditingEntryId(null);
    setSaveError(null);
    navigate(logitCapturePath(project.id));
  };

  const handleCreateProject = async (payload) => {
    const created = await createLogitProject(payload);
    await refreshProjects();
    selectProject(created);
    toast.success('Project created');
  };

  const handleUpdateProject = async (projectId, payload) => {
    await updateLogitProject(projectId, payload);
    await refreshProjects();
    if (activeProject?.id === projectId) {
      setActiveProject((prev) => ({ ...prev, ...payload }));
    }
    toast.success('Project updated');
  };

  const handleDeleteProject = async (projectId) => {
    await deleteLogitProject(projectId);
    if (activeProject?.id === projectId) {
      setActiveProject(null);
      navigate(logitProjectsPath());
    }
    await refreshProjects();
    toast.success('Project deleted');
  };

  const handleTranscriptReady = (text) => {
    setTranscript(text);
    if (route.projectId) {
      navigate(logitTranscriptPath(route.projectId));
    }
  };

  const handleProcess = async () => {
    if (!activeProject || !transcript.trim() || !selectedObservationType) return;
    setProcessing(true);
    setSaveError(null);
    try {
      const result = await classifyLogitObservation(
        activeProject.id,
        transcript.trim(),
        selectedObservationType,
      );
      const classificationResult = {
        ...result.classification,
        type: selectedObservationType,
        severity: result.classification.severity
          || (selectedObservationType === 'idea' || selectedObservationType === 'positive'
            ? 'not_applicable'
            : 'minor'),
      };
      setClassification(classificationResult);
      setAiMeta({ model: result.model, source: result.source });
      navigate(logitReviewPath(activeProject.id));
    } catch {
      navigate(logitTranscriptPath(activeProject.id));
      setSaveError('AI processing is unavailable. Save as draft or try again.');
      toast.error('Could not process observation');
    } finally {
      setProcessing(false);
    }
  };

  const buildEntryPayload = (status) => {
    const base = {
      project_id: activeProject.id,
      original_transcript: transcript.trim(),
      status,
      type: selectedObservationType || classification?.type,
    };
    if (!classification) return base;
    return {
      ...base,
      type: classification.type,
      category: classification.category,
      severity: classification.severity,
      frequency: classification.frequency,
      title: classification.title,
      description: classification.description,
      impact: classification.impact,
      suggested_fix: classification.suggested_fix,
      ai_title: classification.title,
      ai_description: classification.description,
      ai_impact: classification.impact,
      ai_suggested_fix: classification.suggested_fix,
      ai_confidence: classification.confidence,
      ai_model: aiMeta.model,
    };
  };

  const persistEntry = async (status) => {
    if (!activeProject || !transcript.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    const localId = localDraftId || createLocalId();
    const payload = buildEntryPayload(status);

    try {
      if (editingEntryId) {
        const {
          project_id: _projectId,
          original_transcript: _transcript,
          ...updateFields
        } = payload;
        await updateLogitEntry(editingEntryId, updateFields);
      } else {
        await createLogitEntry(payload);
      }
      removeLocalDraft(localId);
      removePendingSave(localId);
      await refreshProjects();
      await refreshEntries(activeProject.id);
      setTranscript('');
      setClassification(null);
      setLocalDraftId(null);
      setEditingEntryId(null);
      setSelectedObservationType(null);
      speech.resetTranscript();
      navigate(logitCapturePath(activeProject.id));
      toast.success(status === 'draft' ? 'Saved as draft' : 'Logged');
    } catch {
      savePendingSave({ localId, payload, savedAt: new Date().toISOString() });
      saveLocalDraft({
        localId,
        projectId: activeProject.id,
        transcript: transcript.trim(),
        classification,
        aiMeta,
        status,
        savedAt: new Date().toISOString(),
      });
      setLocalDraftId(localId);
      setSaveError('Could not save to server. Your observation is preserved on this device.');
      toast.error('Save failed — kept locally');
    } finally {
      setSaving(false);
    }
  };

  const resumeEntryToReview = (entry) => {
    setEditingEntryId(entry.id);
    setTranscript(entry.original_transcript || '');
    setSelectedObservationType(entry.type || null);
    setClassification({
      type: entry.type || 'problem',
      category: entry.category || 'other',
      severity: entry.severity || 'not_applicable',
      frequency: entry.frequency || 'unknown',
      title: entry.title || '',
      description: entry.description || '',
      impact: entry.impact || '',
      suggested_fix: entry.suggested_fix || '',
      confidence: entry.ai_confidence ?? 0.5,
    });
    navigate(logitReviewPath(activeProject.id));
  };

  const resumeEntryToProcess = (entry) => {
    setEditingEntryId(entry.id);
    setTranscript(entry.original_transcript || '');
    setSelectedObservationType(entry.type || 'idea');
    setClassification(null);
    if (entry.type) {
      navigate(logitTranscriptPath(activeProject.id));
      return;
    }
    navigate(logitTypeCapturePath(activeProject.id, entry.type || 'idea'));
  };

  const handleDeleteEntry = async (entry) => {
    const label = entry.title || 'this observation';
    const confirmed = window.confirm(
      `Delete "${label}" permanently? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingEntry(true);
    try {
      await deleteLogitEntry(entry.id);
      await refreshProjects();
      await refreshEntries(activeProject.id);
      setSelectedEntry(null);
      navigate(logitLogPath(activeProject.id));
      toast.success('Observation deleted');
    } catch {
      toast.error('Could not delete — try again');
    } finally {
      setDeletingEntry(false);
    }
  };

  const handleToggleResolved = async (entry, resolved) => {
    if (!activeProject || resolvingEntry) return;
    setResolvingEntry(true);
    try {
      const updated = await updateLogitEntry(entry.id, { resolved });
      await refreshEntries(activeProject.id);
      setSelectedEntry(updated);
      toast.success(resolved ? 'Marked resolved' : 'Marked unresolved');
    } catch {
      toast.error('Could not update — try again');
    } finally {
      setResolvingEntry(false);
    }
  };

  if (authLoading || !router.isReady) {
    return (
      <main className={`${LOGIT_CANVAS} flex items-center justify-center`}>
        <p className="text-white/60">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={`${LOGIT_CANVAS} flex flex-col items-center justify-center px-6 text-center`}>
        <h1 className="text-2xl font-semibold mb-2">LoGiT</h1>
        <p className="text-white/60 mb-6">Sign in to capture field observations.</p>
        <a
          href="/api/auth/login?returnTo=/logit"
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-cyan-500/90 text-white font-medium"
        >
          Sign in
        </a>
      </main>
    );
  }

  if (route.projectId && !activeProject && !projectsLoading) {
    return (
      <main className={`${LOGIT_CANVAS} flex flex-col items-center justify-center px-6 text-center`}>
        <p className="text-white/60 mb-4">Project not found.</p>
        <button
          type="button"
          className="min-h-[44px] px-6 py-2.5 rounded-xl border border-white/15 text-white/80"
          onClick={() => navigate(logitProjectsPath())}
        >
          Back to projects
        </button>
      </main>
    );
  }

  return (
    <main className={LOGIT_CANVAS}>
      {screen === 'projects' && (
        <LogitProjectList
          projects={projects}
          loading={projectsLoading}
          error={projectsError}
          installHint={installHint}
          onSelectProject={selectProject}
          onCreateProject={handleCreateProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
        />
      )}

      {screen === 'capture' && activeProject && (
        <LogitTypeSelect
          project={activeProject}
          unreviewedCount={unreviewedCount}
          onSelectType={(type) => {
            setSelectedObservationType(type);
            speech.resetTranscript();
            navigate(logitTypeCapturePath(activeProject.id, type));
          }}
          onOpenLog={() => {
            refreshEntries(activeProject.id);
            navigate(logitLogPath(activeProject.id));
          }}
          onSwitchProject={() => navigate(logitProjectsPath())}
        />
      )}

      {screen === 'type_capture' && activeProject && selectedObservationType && (
        <LogitTypeCapture
          project={activeProject}
          observationType={selectedObservationType}
          speech={speech}
          onBack={() => {
            speech.resetTranscript();
            navigate(logitCapturePath(activeProject.id));
          }}
          onTranscriptReady={handleTranscriptReady}
        />
      )}

      {screen === 'transcript' && (
        processing ? (
          <LogitProcessing />
        ) : (
          <LogitTranscriptPreview
            transcript={transcript}
            onTranscriptChange={setTranscript}
            onProcess={handleProcess}
            onSaveDraft={() => persistEntry('draft')}
            onCancel={() => {
              if (activeProject) {
                navigate(
                  selectedObservationType
                    ? logitTypeCapturePath(activeProject.id, selectedObservationType)
                    : logitCapturePath(activeProject.id),
                );
              }
              setSaveError(null);
            }}
            processing={processing}
            saveError={saveError}
          />
        )
      )}

      {screen === 'review' && activeProject && classification && (
        <LogitReview
          project={activeProject}
          transcript={transcript}
          classification={classification}
          onChange={setClassification}
          onLogIt={() => persistEntry('logged')}
          onEdit={() => navigate(logitTranscriptPath(activeProject.id))}
          saving={saving}
          saveError={saveError}
        />
      )}

      {screen === 'log' && activeProject && (
        <LogitEntryList
          project={activeProject}
          entries={entries}
          loading={entriesLoading}
          onBack={() => navigate(logitCapturePath(activeProject.id))}
          onSelectEntry={(entry) => navigate(logitEntryPath(activeProject.id, entry.id))}
        />
      )}

      {screen === 'entry' && activeProject && selectedEntry && (
        <LogitEntryDetail
          entry={selectedEntry}
          project={activeProject}
          onBack={() => navigate(logitLogPath(activeProject.id))}
          onProcessDraft={() => resumeEntryToProcess(selectedEntry)}
          onContinueReview={() => resumeEntryToReview(selectedEntry)}
          onToggleResolved={(resolved) => handleToggleResolved(selectedEntry, resolved)}
          onDelete={() => handleDeleteEntry(selectedEntry)}
          deleting={deletingEntry}
          resolving={resolvingEntry}
        />
      )}
    </main>
  );
}
