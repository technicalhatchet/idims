import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FaEye, FaLock, FaTimes, FaEdit } from 'react-icons/fa';
import { useUser } from '@auth0/nextjs-auth0/client';
import { apiClient } from '../../utils/api-client';
import Button from '../ui/Button';
import { SelectInput, TextareaInput, TextInput } from '../ui/FormElements';

const NOTE_TYPES = {
  GENERAL: 'General Note',
  PRE_CALL: 'Pre-Call',
  FOLLOW_UP: 'Follow Up',
  REDO: 'Redo'
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
  ]
};

// Initial field values for structured note types
const getInitialFieldValues = (noteType) => {
  if (!NOTE_FIELDS[noteType]) return {};
  
  return NOTE_FIELDS[noteType].reduce((values, field) => {
    values[field.id] = field.type === 'checkbox' ? false : '';
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
    const value = fieldValues[field.id];
    if (field.type === 'checkbox') {
      return `${field.label}: ${value ? '✓' : '✗'}\n`;
    } else {
      return `${field.label}: ${value || 'N/A'}\n`;
    }
  }).join('');
};

// Format structured fields for API
const formatFieldsForAPI = (fieldValues, noteType) => {
  if (!NOTE_FIELDS[noteType]) return fieldValues.text || '';
  return JSON.stringify(fieldValues);
};

export default function WorkOrderNotes({ workOrderId }) {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useUser();
  const [newNote, setNewNote] = useState({
    type: NOTE_TYPES.GENERAL,
    content: '',
    fieldValues: {},
    isPrivate: false
  });

  useEffect(() => {
    if (workOrderId) {
      fetchNotes();
    }
  }, [workOrderId]);

  useEffect(() => {
    // When note type changes, initialize appropriate field values
    if (NOTE_FIELDS[newNote.type]) {
      setNewNote(prev => ({
        ...prev,
        fieldValues: getInitialFieldValues(newNote.type)
      }));
    }
  }, [newNote.type]);

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching notes for work order:', workOrderId);
      const response = await apiClient(`work-orders/${workOrderId}/notes`);
      console.log('Notes response:', response);
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
    setNewNote({
      ...newNote,
      type,
      content: '',
      fieldValues: getInitialFieldValues(type)
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

  const handleViewNote = (note) => {
    // Extract note type from content
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
      let noteContent;
      if (NOTE_FIELDS[newNote.type]) {
        noteContent = formatFieldsForAPI(newNote.fieldValues, newNote.type);
      } else {
        noteContent = newNote.content;
      }

      await apiClient(`work-orders/${workOrderId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          work_order_id: workOrderId,
          note: `[${newNote.type}]\n${noteContent}`,
          is_private: newNote.isPrivate
        })
      });
      
      // Reset form and refresh notes
      setNewNote({
        type: NOTE_TYPES.GENERAL,
        content: '',
        fieldValues: {},
        isPrivate: false
      });
      fetchNotes();
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

  // Render a field based on its type
  const renderField = (field, value, readOnly = false) => {
    switch (field.type) {
      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={field.id}
              checked={value}
              onChange={(e) => !readOnly && handleFieldChange(field.id, e.target.checked)}
              disabled={readOnly}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor={field.id} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              {field.label}
            </label>
          </div>
        );
      case 'select':
        return (
          <SelectInput
            label={field.label}
            id={field.id}
            value={value || ''}
            onChange={(e) => !readOnly && handleFieldChange(field.id, e.target.value)}
            options={field.options}
            disabled={readOnly}
          />
        );
      case 'textarea':
        return (
          <TextareaInput
            label={field.label}
            id={field.id}
            value={value || ''}
            onChange={(e) => !readOnly && handleFieldChange(field.id, e.target.value)}
            rows={3}
            disabled={readOnly}
          />
        );
      default:
        return (
          <TextInput
            label={field.label}
            id={field.id}
            value={value || ''}
            onChange={(e) => !readOnly && handleFieldChange(field.id, e.target.value)}
            disabled={readOnly}
          />
        );
    }
  };

  // Render form fields or note content based on the note type
  const renderNoteFields = (noteType, fieldValues, readOnly = false) => {
    if (!NOTE_FIELDS[noteType]) {
      return (
        <TextareaInput
          label="Note Content"
          id="noteContent"
          value={readOnly ? fieldValues.text || '' : newNote.content}
          onChange={(e) => !readOnly && setNewNote({ ...newNote, content: e.target.value })}
          rows={8}
          placeholder={readOnly ? '' : "Enter your note here..."}
          disabled={readOnly}
        />
      );
    }

    return (
      <div className="space-y-4">
        {NOTE_FIELDS[noteType].map(field => (
          <div key={field.id} className="mb-4">
            {renderField(field, fieldValues[field.id], readOnly)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Note Viewer Modal */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedNote.type} - {format(new Date(selectedNote.created_at.endsWith('Z') ? selectedNote.created_at : selectedNote.created_at + 'Z'), 'MMM d, yyyy h:mm a')}
              </h3>
              <button 
                onClick={() => { setSelectedNote(null); setIsEditing(false); }}
                className="text-gray-400 hover:text-gray-500"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Added by: {selectedNote.user_name} 
              {selectedNote.is_private && (
                <span className="ml-2 text-yellow-500" title="Private Note">
                  <FaLock className="h-4 w-4 inline mr-1" />
                  Private
                </span>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              {isEditing ? (
                <textarea
                  className="w-full px-3 py-2 border border-blue-400 rounded dark:bg-gray-600 dark:text-white text-sm"
                  rows={8}
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                />
              ) : (
                renderNoteFields(selectedNote.type, selectedNote.fieldValues, true)
              )}
            </div>
            
            <div className="mt-6 flex justify-between">
              {isEditing ? (
                <div className="flex gap-2">
                  <Button onClick={() => setIsEditing(false)} variant="secondary">Cancel</Button>
                  <Button
                    variant="primary"
                    disabled={isSaving}
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        const match = editContent.match(/^\[(.*?)\]\n/);
                        const noteType = match ? match[1] : selectedNote.type;
                        const updatedNote = `[${noteType}]\n${match ? editContent.substring(match[0].length) : editContent}`;
                        await apiClient(`work-orders/${workOrderId}/notes/${selectedNote.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ note: updatedNote })
                        });
                        setIsEditing(false);
                        setSelectedNote(null);
                        fetchNotes();
                      } catch(e) { alert('Failed to save: ' + e.message); }
                      finally { setIsSaving(false); }
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    setEditContent(selectedNote.content);
                    setIsEditing(true);
                  }}
                  variant="secondary"
                >
                  <FaEdit className="inline h-3 w-3 mr-1" /> Edit
                </Button>
              )}
              <Button onClick={() => { setSelectedNote(null); setIsEditing(false); }} variant="secondary">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Notes List */}
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
              {notes.map((note) => {
                const match = note.note.match(/^\[(.*?)\]\n/);
                const noteType = match ? match[1] : 'Note';
                // Append Z if no timezone info so it parses as UTC
                const dateStr = note.created_at.endsWith('Z') ? note.created_at : note.created_at + 'Z';
                const noteDate = new Date(dateStr);
                
                return (
                  <li
                    key={note.id}
                    className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => handleViewNote(note)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                          {noteType}
                        </span>
                        {note.is_private && (
                          <FaLock className="h-3 w-3 text-yellow-500 flex-shrink-0" title="Private" />
                        )}
                      </div>
                      <FaEye className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{note.user_name}</span>
                      <span>{format(noteDate, 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Add New Note Form */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add New Note</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Save Note
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 