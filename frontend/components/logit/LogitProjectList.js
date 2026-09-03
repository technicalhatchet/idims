import { useState } from 'react';
import { LogitCenteredLogo } from './LogitHeader';
import LogitInstallHint from './LogitInstallHint';
import { LOGIT_BUTTON_SECONDARY, LOGIT_GLASS_CARD } from './logitUi';
import { LogitProjectModalControlled } from './LogitProjectModal';

export default function LogitProjectList({
  projects,
  loading,
  error,
  installHint,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [menuProjectId, setMenuProjectId] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editingProject) {
        await onUpdateProject(editingProject.id, payload);
      } else {
        await onCreateProject(payload);
      }
      setModalOpen(false);
      setEditingProject(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project) => {
    const confirmed = window.confirm(
      `Delete "${project.name}" and all its observations? This cannot be undone.`,
    );
    if (!confirmed) return;
    await onDeleteProject(project.id);
    setMenuProjectId(null);
  };

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-8" style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)' }}>
      <header className="text-center mb-8">
        <div className="flex justify-center mb-2">
          <LogitCenteredLogo className="h-12 sm:h-14" />
        </div>
        <p className="text-white/60 mt-2">What are you working on?</p>
      </header>

      {installHint ? <LogitInstallHint installHint={installHint} /> : null}

      {loading && <p className="text-center text-white/50">Loading projects…</p>}
      {error && (
        <p className="text-center text-amber-300/90 text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {!loading && projects.length === 0 && (
        <div className={`p-6 text-center ${LOGIT_GLASS_CARD}`}>
          <p className="text-white/70 mb-2">No projects yet.</p>
          <p className="text-white/50 text-sm">Create a project to start capturing observations.</p>
        </div>
      )}

      <ul className="space-y-3">
        {projects.map((project) => (
          <li key={project.id} className="relative">
            <button
              type="button"
              className={`w-full text-left p-4 ${LOGIT_GLASS_CARD} hover:bg-white/[0.06] transition min-h-[72px]`}
              onClick={() => onSelectProject(project)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden="true">{project.icon || '📝'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{project.name}</p>
                  <p className="text-sm text-white/50 mt-0.5">
                    {project.entry_count || 0} observation{(project.entry_count || 0) === 1 ? '' : 's'}
                    {project.unreviewed_count > 0 ? ` · ${project.unreviewed_count} unreviewed` : ''}
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/40 hover:text-white/80"
              aria-label={`Project menu for ${project.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuProjectId(menuProjectId === project.id ? null : project.id);
              }}
            >
              ⋯
            </button>
            {menuProjectId === project.id && (
              <div className={`absolute right-3 top-14 z-10 p-2 ${LOGIT_GLASS_CARD} shadow-xl min-w-[140px]`}>
                <button
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 rounded-lg min-h-[44px]"
                  onClick={() => {
                    setEditingProject(project);
                    setModalOpen(true);
                    setMenuProjectId(null);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-white/5 rounded-lg min-h-[44px]"
                  onClick={() => handleDelete(project)}
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`mt-8 w-full ${LOGIT_BUTTON_SECONDARY}`}
        onClick={() => {
          setEditingProject(null);
          setModalOpen(true);
        }}
      >
        + New Project
      </button>

      <LogitProjectModalControlled
        open={modalOpen}
        project={editingProject}
        onClose={() => {
          setModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
