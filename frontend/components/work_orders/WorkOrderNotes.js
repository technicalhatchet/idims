import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { FaEye, FaLock, FaTimes, FaEdit, FaPlus } from 'react-icons/fa';
import { apiClient } from '../../utils/api-client';
import { createWorkOrderNoteOffline, fetchWorkOrderNotes } from '../../lib/offlineWrites';
import Button from '../ui/Button';
import { SelectInput, TextareaInput, TextInput } from '../ui/FormElements';
import {
  DMA_PROBLEM_CODES,
  DMA_RESOLUTION_CODES,
  REPAIR_OUTCOME_NOTE_TYPE,
  codeOptions,
  codeLabel,
} from '../../constants/dmaCodes';
import DmaTagPicker from '../dma/DmaTagPicker';
import WorkOrderPhotosSection from './WorkOrderPhotosSection';

const NOTE_TYPES = {
  GENERAL: 'General Note',
  PRE_CALL: 'Pre-Call',
  FOLLOW_UP: 'Follow Up',
  REDO: 'Redo',
  REPAIR_OUTCOME: REPAIR_OUTCOME_NOTE_TYPE,
};

// Define field structure for each note type
const NOTE_FIELDS = {
  [NOTE_TYPES.PRE_CALL]: [
    { id: 'clientContactStatus', label: 'Client Contact Status', type: 'select', options: [
      { value: 'Connected', label: 'Connected' },
      { value: 'Left VM', label: 'Left VM' },
      { value: 'No VM Setup', label: 'No VM Setup' },
      { value: 'LNIS', label: 'LNIS' }
    ] },
    { id: 'appointmentTime', label: 'Appointment Time', type: 'text' },
    { id: 'detailsReviewed', label: 'Work Order Details Reviewed', type: 'checkbox' },
    { id: 'toolsReady', label: 'Tools and Parts Prepared', type: 'checkbox' },
    { id: 'additionalNotes', label: 'Additional Notes', type: 'textarea' }
  ],
  [NOTE_TYPES.FOLLOW_UP]: [
    { id: 'servicePerformed', label: 'Service Performed', type: 'text' },
    { id: 'partsUsed', label: 'Parts Used', type: 'text' },
    { id: 'clientFeedback', label: 'Client Feedback', type: 'text' },
    { id: 'nextSteps', label: 'Next Steps', type: 'text' },
    { id: 'additionalNotes', label: 'Additional Notes', type: 'textarea' }
  ],
  [NOTE_TYPES.REDO]: [
    { id: 'originalIssue', label: 'Original Issue', type: 'text' },
    { id: 'previousAttempts', label: 'Previous Attempts', type: 'text' },
    { id: 'newApproach', label: 'New Approach', type: 'text' },
    { id: 'requiredParts', label: 'Required Parts', type: 'text' },
    { id: 'additionalNotes', label: 'Additional Notes', type: 'textarea' }
  ],
  [NOTE_TYPES.REPAIR_OUTCOME]: [
    { id: 'customerComplaint', label: 'Customer Complaint', type: 'textarea' },
    {
      id: 'problemCode',
      label: 'Problem Code',
      type: 'select',
      options: [{ value: '', label: 'Select problem…' }, ...codeOptions(DMA_PROBLEM_CODES)],
    },
    {
      id: 'resolutionCode',
      label: 'Resolution Code',
      type: 'select',
      options: [{ value: '', label: 'Select resolution…' }, ...codeOptions(DMA_RESOLUTION_CODES)],
    },
    { id: 'confirmedFix', label: 'Confirmed Fix (required)', type: 'text' },
    { id: 'errorCodeText', label: 'Error Code (optional)', type: 'text' },
    { id: 'replacedParts', label: 'Replaced Parts', type: 'text' },
    { id: 'repairSuccessful', label: 'Repair successful', type: 'checkbox' },
    { id: 'callbackRequired', label: 'Callback required', type: 'checkbox' },
    { id: 'repairComments', label: 'Repair Comments', type: 'textarea' },
    { id: 'tags', label: 'Repair tags', type: 'tags' },
  ],
};

// Initial field values for structured note types
const getInitialFieldValues = (noteType) => {
  if (!NOTE_FIELDS[noteType]) return {};

  return NOTE_FIELDS[noteType].reduce((values, field) => {
    if (field.type === 'checkbox') {
      values[field.id] = field.id === 'repairSuccessful' ? true : false;
    } else if (field.type === 'tags') {
      values[field.id] = [];
    } else {
      values[field.id] = '';
    }
    return values;
  }, {});
};

// Parse structured note content
const parseNoteContent = (content, noteType) => {
  if (!NOTE_FIELDS[noteType]) return { text: content };

  try {
    return JSON.parse(content);
  } catch (e) {
    return { text: content };
  }
};

// Format structured fields for display
const formatFieldsForDisplay = (fieldValues, noteType) => {
  if (!NOTE_FIELDS[noteType]) return fieldValues.text || '';

  return NOTE_FIELDS[noteType].map(field => {
    let value = fieldValues[field.id];
    if (field.type === 'checkbox') {
      return `${field.label}: ${value ? '✓' : '✗'}\n`;
    }
    if (field.id === 'tags') {
      const labels = Array.isArray(value) ? value.join(', ') : '';
      return `${field.label}: ${labels || 'N/A'}\n`;
    }
    if (field.id === 'problemCode') {
      value = codeLabel(DMA_PROBLEM_CODES, value);
    } else if (field.id === 'resolutionCode') {
      value = codeLabel(DMA_RESOLUTION_CODES, value);
    }
    return `${field.label}: ${value || 'N/A'}\n`;
  }).join('');
};

// Format structured fields for API
const formatFieldsForAPI = (fieldValues, noteType) => {
  if (!NOTE_FIELDS[noteType]) return fieldValues.text || '';
  return JSON.stringify(fieldValues);
};

const EMPTY_NOTE = {
  type: NOTE_TYPES.GENERAL,
  content: '',
  fieldValues: {},
  isPrivate: false,
};

export default function WorkOrderNotes({
  workOrderId,
  workOrder = null,
  variant = 'desktop',
  addSheetOpen: addSheetOpenProp,
  onAddSheetOpenChange,
  addNoteType = null,
  photoSheetOpen = false,
  onPhotoSheetOpenChange = null,
}) {
  const isMobile = variant === 'mobile';
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editFieldValues, setEditFieldValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [internalAddSheetOpen, setInternalAddSheetOpen] = useState(false);
  const [newNote, setNewNote] = useState({ ...EMPTY_NOTE });

  const addSheetOpen = onAddSheetOpenChange != null ? addSheetOpenProp : internalAddSheetOpen;
  const setAddSheetOpen = onAddSheetOpenChange ?? setInternalAddSheetOpen;

  const buildNewNoteState = useCallback((type = NOTE_TYPES.GENERAL) => {
    let fieldValues = getInitialFieldValues(type);
    if (type === NOTE_TYPES.REPAIR_OUTCOME && workOrder) {
      const symptomText = Array.isArray(workOrder.symptoms) && workOrder.symptoms.length
        ? workOrder.symptoms.join(', ')
        : '';
      fieldValues = {
        ...fieldValues,
        customerComplaint: workOrder.description || symptomText || '',
      };
    }
    return {
      type,
      content: '',
      fieldValues,
      isPrivate: false,
    };
  }, [workOrder]);

  const resetNewNoteForm = useCallback(() => {
    setNewNote(buildNewNoteState(NOTE_TYPES.GENERAL));
  }, [buildNewNoteState]);

  const openAddSheet = useCallback(() => {
    resetNewNoteForm();
    setAddSheetOpen(true);
  }, [resetNewNoteForm, setAddSheetOpen]);

  const closeAddSheet = useCallback(() => {
    setAddSheetOpen(false);
  }, [setAddSheetOpen]);

  useEffect(() => {
    if (workOrderId) {
      fetchNotes();
    }
  }, [workOrderId]);

  useEffect(() => {
    if (NOTE_FIELDS[newNote.type]) {
      setNewNote(prev => ({
        ...prev,
        fieldValues: getInitialFieldValues(newNote.type)
      }));
    }
  }, [newNote.type]);

  const prevAddSheetOpen = useRef(false);
  const addPanelRef = useRef(null);
  const viewPanelRef = useRef(null);

  useEffect(() => {
    if (isMobile && addSheetOpen && !prevAddSheetOpen.current) {
      if (addNoteType && NOTE_FIELDS[addNoteType]) {
        setNewNote(buildNewNoteState(addNoteType));
      } else {
        resetNewNoteForm();
      }
    }
    prevAddSheetOpen.current = addSheetOpen;
  }, [addSheetOpen, isMobile, resetNewNoteForm, addNoteType, buildNewNoteState]);

  useEffect(() => {
    if (!isMobile || !addSheetOpen || !addPanelRef.current) return;
    addPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isMobile, addSheetOpen]);

  useEffect(() => {
    if (!isMobile || !selectedNote || !viewPanelRef.current) return;
    viewPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isMobile, selectedNote]);

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const response = await fetchWorkOrderNotes(workOrderId);
      setNotes(response);
      setError(null);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteTypeChange = (e) => {
    const type = e.target.value;
    let fieldValues = getInitialFieldValues(type);
    if (type === NOTE_TYPES.REPAIR_OUTCOME && workOrder) {
      const symptomText = Array.isArray(workOrder.symptoms) && workOrder.symptoms.length
        ? workOrder.symptoms.join(', ')
        : '';
      fieldValues.customerComplaint = workOrder.description || symptomText || '';
    }
    setNewNote({
      ...newNote,
      type,
      content: '',
      fieldValues,
    });
  };

  const handleFieldChange = (fieldId, value) => {
    setNewNote(prev => ({
      ...prev,
      fieldValues: {
        ...prev.fieldValues,
        [fieldId]: value
      }
    }));
  };

  const handleEditFieldChange = (fieldId, value) => {
    setEditFieldValues(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const startEditingNote = () => {
    if (!selectedNote) return;
    if (NOTE_FIELDS[selectedNote.type]) {
      setEditFieldValues({
        ...getInitialFieldValues(selectedNote.type),
        ...selectedNote.fieldValues,
      });
      setEditContent('');
    } else {
      setEditContent(selectedNote.content);
      setEditFieldValues({});
    }
    setIsEditing(true);
  };

  const cancelEditingNote = () => {
    setIsEditing(false);
    setEditContent('');
    setEditFieldValues({});
  };

  const saveEditedNote = async () => {
    if (!selectedNote) return;
    setIsSaving(true);
    try {
      let noteBody;
      if (NOTE_FIELDS[selectedNote.type]) {
        if (selectedNote.type === NOTE_TYPES.REPAIR_OUTCOME) {
          const fix = (editFieldValues?.confirmedFix || '').trim();
          if (!fix) {
            alert('Confirmed Fix is required for Repair Outcome notes.');
            setIsSaving(false);
            return;
          }
        }
        noteBody = formatFieldsForAPI(editFieldValues, selectedNote.type);
      } else {
        noteBody = editContent;
      }
      const updatedNote = `[${selectedNote.type}]\n${noteBody}`;
      await apiClient(`work-orders/${workOrderId}/notes/${selectedNote.id}`, {
        method: 'PUT',
        body: JSON.stringify({ note: updatedNote }),
      });
      cancelEditingNote();
      setSelectedNote(null);
      fetchNotes();
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewNote = (note) => {
    const match = note.note.match(/^\[(.*?)\]\n/);
    const noteType = match ? match[1] : NOTE_TYPES.GENERAL;
    const content = match ? note.note.substring(match[0].length) : note.note;

    setSelectedNote({
      ...note,
      type: noteType,
      content,
      fieldValues: parseNoteContent(content, noteType)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (newNote.type === NOTE_TYPES.REPAIR_OUTCOME) {
        const fix = (newNote.fieldValues?.confirmedFix || '').trim();
        if (!fix) {
          setError('Confirmed Fix is required for Repair Outcome notes.');
          return;
        }
      }

      let noteContent;
      if (NOTE_FIELDS[newNote.type]) {
        noteContent = formatFieldsForAPI(newNote.fieldValues, newNote.type);
      } else {
        noteContent = newNote.content;
      }

      const result = await createWorkOrderNoteOffline({
        workOrderId,
        note: `[${newNote.type}]\n${noteContent}`,
        isPrivate: newNote.isPrivate,
      });

      resetNewNoteForm();
      closeAddSheet();
      await fetchNotes();

      if (result?.queued) {
        setError(null);
      }
    } catch (err) {
      console.error('Error creating note:', err);
      setError('Failed to create note');
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading notes...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-8">{error}</div>;
  }

  const renderField = (field, value, readOnly = false, onChange = handleFieldChange, idSuffix = '') => {
    const fieldDomId = `${field.id}${idSuffix}`;
    switch (field.type) {
      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={fieldDomId}
              checked={!!value}
              onChange={(e) => !readOnly && onChange(field.id, e.target.checked)}
              disabled={readOnly}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor={fieldDomId} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              {field.label}
            </label>
          </div>
        );
      case 'select':
        return (
          <SelectInput
            label={field.label}
            id={fieldDomId}
            value={value || ''}
            onChange={(e) => !readOnly && onChange(field.id, e.target.value)}
            options={field.options}
            disabled={readOnly}
          />
        );
      case 'textarea':
        return (
          <TextareaInput
            label={field.label}
            id={fieldDomId}
            value={value || ''}
            onChange={(e) => !readOnly && onChange(field.id, e.target.value)}
            rows={3}
            disabled={readOnly}
          />
        );
      case 'tags':
        if (readOnly) {
          const labels = Array.isArray(value) && value.length ? value.join(', ') : 'None';
          return (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{labels}</p>
            </div>
          );
        }
        return (
          <DmaTagPicker
            label={field.label}
            variant={isMobile ? 'dark' : 'light'}
            value={Array.isArray(value) ? value : []}
            onChange={(tags) => onChange(field.id, tags)}
          />
        );
      default:
        return (
          <TextInput
            label={field.label}
            id={fieldDomId}
            value={value || ''}
            onChange={(e) => !readOnly && onChange(field.id, e.target.value)}
            disabled={readOnly}
          />
        );
    }
  };

  const renderNoteFields = (noteType, fieldValues, readOnly = false, onFieldChange = handleFieldChange, idSuffix = '') => {
    if (!NOTE_FIELDS[noteType]) {
      return (
        <TextareaInput
          label="Note Content"
          id="noteContent"
          value={readOnly ? fieldValues.text || '' : newNote.content}
          onChange={(e) => !readOnly && setNewNote({ ...newNote, content: e.target.value })}
          rows={8}
          placeholder={readOnly ? '' : 'Enter your note here...'}
          disabled={readOnly}
        />
      );
    }

    return (
      <div className="space-y-4">
        {NOTE_FIELDS[noteType].map(field => (
          <div key={field.id} className="mb-4">
            {renderField(field, fieldValues[field.id], readOnly, onFieldChange, idSuffix)}
          </div>
        ))}
      </div>
    );
  };

  const addNoteForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SelectInput
        label="Note Type"
        id="noteType"
        value={newNote.type}
        onChange={handleNoteTypeChange}
        options={Object.values(NOTE_TYPES).map(type => ({ value: type, label: type }))}
      />

      {renderNoteFields(newNote.type, newNote.fieldValues)}

      <div className="flex items-center">
        <input
          type="checkbox"
          id="isPrivate"
          checked={newNote.isPrivate}
          onChange={(e) => setNewNote({ ...newNote, isPrivate: e.target.checked })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="isPrivate" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
          Private Note (only visible to staff)
        </label>
      </div>

      <div className="flex justify-end gap-2">
        {isMobile && (
          <Button type="button" variant="secondary" onClick={closeAddSheet}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary">
          Save Note
        </Button>
      </div>
    </form>
  );

  const noteViewerTitle = selectedNote && (
    <>
      {selectedNote.type} — {format(
        new Date(selectedNote.created_at.endsWith('Z') ? selectedNote.created_at : selectedNote.created_at + 'Z'),
        'MMM d, yyyy h:mm a'
      )}
    </>
  );

  const noteViewerBody = selectedNote && (
    <>
      <div className={`mb-4 text-sm ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
        Added by: {selectedNote.user_name}
        {selectedNote.is_private && (
          <span className="ml-2 text-yellow-500" title="Private Note">
            <FaLock className="h-4 w-4 inline mr-1" />
            Private
          </span>
        )}
      </div>

      <div className={`p-4 rounded-lg ${isMobile ? 'bg-white/5 border border-white/10' : 'bg-gray-50 dark:bg-gray-700'}`}>
        {isEditing ? (
          NOTE_FIELDS[selectedNote.type] ? (
            renderNoteFields(
              selectedNote.type,
              editFieldValues,
              false,
              handleEditFieldChange,
              '-edit',
            )
          ) : (
            <textarea
              className="w-full px-3 py-2 border border-blue-400 rounded dark:bg-gray-600 dark:text-white text-sm"
              rows={8}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
            />
          )
        ) : (
          renderNoteFields(selectedNote.type, selectedNote.fieldValues, true)
        )}
      </div>

      <div className={`mt-6 flex ${isMobile ? 'flex-col gap-2' : 'justify-between'}`}>
        {isEditing ? (
          <div className="flex gap-2">
            <Button onClick={cancelEditingNote} variant="secondary">Cancel</Button>
            <Button
              variant="primary"
              disabled={isSaving}
              onClick={saveEditedNote}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        ) : (
          <Button
            onClick={startEditingNote}
            className="px-4 py-2 bg-orange-400 hover:bg-orange-500 text-white rounded-md text-sm font-medium"
          >
            <FaEdit className="inline h-3 w-3 mr-1" /> Edit
          </Button>
        )}
        <Button onClick={() => { setSelectedNote(null); cancelEditingNote(); }} variant="primary">
          Close
        </Button>
      </div>
    </>
  );

  const mobilePanelShell = (title, onClose, body, panelRef) => (
    <div
      ref={panelRef}
      className="mb-4 overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#0f172a] shadow-[0_0_24px_rgba(34,211,238,0.12)]"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <FaTimes className="h-5 w-5" />
        </button>
      </div>
      <div className="px-4 py-4">{body}</div>
    </div>
  );

  const renderNoteListItem = (note, asButton = false) => {
    const match = note.note.match(/^\[(.*?)\]\n/);
    const noteType = match ? match[1] : 'Note';
    const dateStr = note.created_at.endsWith('Z') ? note.created_at : note.created_at + 'Z';
    const noteDate = new Date(dateStr);

    const inner = (
      <>
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm font-medium truncate ${asButton ? 'font-semibold text-cyan-300' : 'text-blue-600 dark:text-blue-400'}`}>
              {noteType}
            </span>
            {note.is_private && (
              <FaLock className="h-3 w-3 text-yellow-500 flex-shrink-0" title="Private" />
            )}
            {note.pendingSync && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400 flex-shrink-0">
                Pending sync
              </span>
            )}
          </div>
          <FaEye className={`h-4 w-4 flex-shrink-0 mt-0.5 ${asButton ? 'text-gray-500' : 'text-gray-400'}`} />
        </div>
        <div className={`mt-1 flex flex-wrap gap-x-3 text-xs ${asButton ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
          <span>{note.user_name}</span>
          <span>{format(noteDate, 'MMM d, yyyy h:mm a')}</span>
        </div>
      </>
    );

    if (asButton) {
      return (
        <button
          key={note.id}
          type="button"
          onClick={() => handleViewNote(note)}
          className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 active:bg-white/[0.06] transition-colors"
        >
          {inner}
        </button>
      );
    }

    return (
      <li
        key={note.id}
        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
        onClick={() => handleViewNote(note)}
      >
        {inner}
      </li>
    );
  };

  if (isMobile) {
    return (
      <div className="min-w-0">
        {addSheetOpen && mobilePanelShell('Add note', closeAddSheet, addNoteForm, addPanelRef)}

        {selectedNote && mobilePanelShell(
          noteViewerTitle,
          () => { setSelectedNote(null); cancelEditingNote(); },
          <div className="text-gray-200">{noteViewerBody}</div>,
          viewPanelRef,
        )}

        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 px-0.5">
          Notes history
        </h3>

        {notes.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm rounded-xl border border-dashed border-white/15">
            No notes yet. Tap Add note below to create one.
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {notes.map(note => renderNoteListItem(note, true))}
          </div>
        )}

        <WorkOrderPhotosSection
          workOrderId={workOrderId}
          variant="mobile"
          uploadOpen={photoSheetOpen}
          onUploadOpenChange={onPhotoSheetOpenChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {noteViewerTitle}
              </h3>
              <button
                onClick={() => { setSelectedNote(null); cancelEditingNote(); }}
                className="text-gray-400 hover:text-gray-500"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>
            {noteViewerBody}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notes History</h3>
        </div>
        <div>
          {notes.length === 0 ? (
            <div className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
              No notes yet
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {notes.map(note => renderNoteListItem(note, false))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add New Note</h3>
        </div>
        <div className="p-6">{addNoteForm}</div>
      </div>

      <WorkOrderPhotosSection workOrderId={workOrderId} variant="desktop" />
    </div>
  );
}
