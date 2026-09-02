import { useState } from 'react';
import {
  LOGIT_BUTTON_PRIMARY,
  LOGIT_BUTTON_SECONDARY,
  LOGIT_GLASS_CARD,
  LOGIT_INPUT,
  LOGIT_TEXTAREA,
} from './logitUi';

const EMPTY_FORM = { name: '', context: '', icon: '📝' };

export default function LogitProjectModal({
  open,
  initial,
  onClose,
  onSave,
  saving,
}) {
  const [form, setForm] = useState(() => initial || EMPTY_FORM);

  if (!open) return null;

  const isEdit = Boolean(initial?.id);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      context: form.context.trim(),
      icon: form.icon.trim() || '📝',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className={`w-full max-w-md p-5 ${LOGIT_GLASS_CARD}`} role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit project' : 'New project'}>
        <h2 className="text-lg font-semibold mb-4">{isEdit ? 'Edit project' : 'New project'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-white/60 mb-1" htmlFor="logit-project-icon">Icon</label>
            <input
              id="logit-project-icon"
              className={LOGIT_INPUT}
              value={form.icon}
              onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
              maxLength={4}
              aria-label="Project icon"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1" htmlFor="logit-project-name">Name</label>
            <input
              id="logit-project-name"
              className={LOGIT_INPUT}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1" htmlFor="logit-project-context">Context</label>
            <textarea
              id="logit-project-context"
              className={LOGIT_TEXTAREA}
              rows={4}
              value={form.context}
              onChange={(e) => setForm((prev) => ({ ...prev, context: e.target.value }))}
              placeholder="Short description so AI understands this project…"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className={`flex-1 ${LOGIT_BUTTON_SECONDARY}`} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`flex-1 ${LOGIT_BUTTON_PRIMARY}`} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LogitProjectModalControlled({ open, project, onClose, onSave, saving }) {
  const initial = project
    ? { id: project.id, name: project.name, context: project.context || '', icon: project.icon || '📝' }
    : EMPTY_FORM;

  return (
    <LogitProjectModal
      key={project?.id || 'new'}
      open={open}
      initial={initial}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
    />
  );
}
