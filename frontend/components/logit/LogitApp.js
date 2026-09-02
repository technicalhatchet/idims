import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useLogitSpeech } from '../../hooks/useLogitSpeech';
import {
  classifyLogitObservation,
  createLogitEntry,
  createLogitProject,
  deleteLogitProject,
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

const SCREENS = {
  PROJECTS: 'projects',
  CAPTURE: 'capture',
  TYPE_CAPTURE: 'type_capture',
  TRANSCRIPT: 'transcript',
  PROCESSING: 'processing',
  REVIEW: 'review',
  LOG: 'log',
  ENTRY: 'entry',
};

export default function LogitApp() {
  const { user, isLoading: authLoading } = useUser();
  const speech = useLogitSpeech();

  const [screen, setScreen] = useState(SCREENS.PROJECTS);
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
  const hasAutoOpenedRef = useRef(false);

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const data = await fetchLogitProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
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
    if (!user || projectsLoading || projects.length === 0 || hasAutoOpenedRef.current) return;
    const lastId = getLastProjectId();
    const lastProject = projects.find((p) => p.id === lastId);
    if (lastProject) {
      hasAutoOpenedRef.current = true;
      setActiveProject(lastProject);
      setScreen(SCREENS.CAPTURE);
      refreshEntries(lastProject.id);
    }
  }, [user, projects, projectsLoading, refreshEntries]);

  const unreviewedCount = useMemo(() => {
    if (activeProject?.unreviewed_count != null) return activeProject.unreviewed_count;
    return entries.filter((e) => e.status === 'draft').length;
  }, [activeProject, entries]);

  const selectProject = (project) => {
    setActiveProject(project);
    setLastProjectId(project.id);
    setScreen(SCREENS.CAPTURE);
    refreshEntries(project.id);
    speech.resetTranscript();
    setTranscript('');
    setClassification(null);
    setSelectedObservationType(null);
    setEditingEntryId(null);
    setSaveError(null);
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
      setScreen(SCREENS.PROJECTS);
    }
    await refreshProjects();
    toast.success('Project deleted');
  };

  const handleTranscriptReady = (text) => {
    setTranscript(text);
    setScreen(SCREENS.TRANSCRIPT);
  };

  const handleProcess = async () => {
    if (!activeProject || !transcript.trim() || !selectedObservationType) return;
    setProcessing(true);
    setScreen(SCREENS.PROCESSING);
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
      setScreen(SCREENS.REVIEW);
    } catch {
      setScreen(SCREENS.TRANSCRIPT);
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
      setScreen(SCREENS.CAPTURE);
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
    setScreen(SCREENS.REVIEW);
  };

  const resumeEntryToProcess = (entry) => {
    setEditingEntryId(entry.id);
    setTranscript(entry.original_transcript || '');
    setSelectedObservationType(entry.type || 'idea');
    setClassification(null);
    if (entry.type) {
      setScreen(SCREENS.TRANSCRIPT);
      return;
    }
    setScreen(SCREENS.TYPE_CAPTURE);
  };

  if (authLoading) {
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

  return (
    <main className={LOGIT_CANVAS}>
      {screen === SCREENS.PROJECTS && (
        <LogitProjectList
          projects={projects}
          loading={projectsLoading}
          error={projectsError}
          onSelectProject={selectProject}
          onCreateProject={handleCreateProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
        />
      )}

      {screen === SCREENS.CAPTURE && activeProject && (
        <LogitTypeSelect
          project={activeProject}
          unreviewedCount={unreviewedCount}
          onSelectType={(type) => {
            setSelectedObservationType(type);
            speech.resetTranscript();
            setScreen(SCREENS.TYPE_CAPTURE);
          }}
          onOpenLog={() => {
            refreshEntries(activeProject.id);
            setScreen(SCREENS.LOG);
          }}
          onSwitchProject={() => setScreen(SCREENS.PROJECTS)}
        />
      )}

      {screen === SCREENS.TYPE_CAPTURE && activeProject && selectedObservationType && (
        <LogitTypeCapture
          project={activeProject}
          observationType={selectedObservationType}
          speech={speech}
          onBack={() => {
            speech.resetTranscript();
            setScreen(SCREENS.CAPTURE);
          }}
          onTranscriptReady={handleTranscriptReady}
        />
      )}

      {screen === SCREENS.TRANSCRIPT && (
        <LogitTranscriptPreview
          transcript={transcript}
          onTranscriptChange={setTranscript}
          onProcess={handleProcess}
          onSaveDraft={() => persistEntry('draft')}
          onCancel={() => {
            setScreen(selectedObservationType ? SCREENS.TYPE_CAPTURE : SCREENS.CAPTURE);
            setSaveError(null);
          }}
          processing={processing}
          saveError={saveError}
        />
      )}

      {screen === SCREENS.PROCESSING && <LogitProcessing />}

      {screen === SCREENS.REVIEW && activeProject && classification && (
        <LogitReview
          project={activeProject}
          transcript={transcript}
          classification={classification}
          onChange={setClassification}
          onLogIt={() => persistEntry('logged')}
          onEdit={() => setScreen(SCREENS.TRANSCRIPT)}
          saving={saving}
          saveError={saveError}
        />
      )}

      {screen === SCREENS.LOG && activeProject && (
        <LogitEntryList
          project={activeProject}
          entries={entries}
          loading={entriesLoading}
          onBack={() => setScreen(SCREENS.CAPTURE)}
          onSelectEntry={(entry) => {
            setSelectedEntry(entry);
            if (entry.status === 'draft') {
              setScreen(SCREENS.ENTRY);
              return;
            }
            setScreen(SCREENS.ENTRY);
          }}
        />
      )}

      {screen === SCREENS.ENTRY && activeProject && selectedEntry && (
        <LogitEntryDetail
          entry={selectedEntry}
          project={activeProject}
          onBack={() => setScreen(SCREENS.LOG)}
          onProcessDraft={() => resumeEntryToProcess(selectedEntry)}
          onContinueReview={() => resumeEntryToReview(selectedEntry)}
        />
      )}
    </main>
  );
}
