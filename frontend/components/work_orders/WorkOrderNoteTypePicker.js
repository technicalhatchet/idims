import { FaClipboardList } from 'react-icons/fa';
import Modal from '../ui/Modal';
import MobileActionSheet from '../ui/MobileActionSheet';
import { MANUAL_NOTE_TYPES, NOTE_TYPE_DESCRIPTIONS, getNoteTypePickerLabel } from '../../constants/workOrderNoteTypes';

function TypeList({ onSelect, isMobile }) {
  return (
    <div className="space-y-2">
      {MANUAL_NOTE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
            isMobile
              ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08]'
              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500'
          }`}
        >
          <span
            className={`block text-sm font-semibold ${
              isMobile ? 'text-white' : 'text-gray-900 dark:text-white'
            }`}
          >
            {getNoteTypePickerLabel(type)}
          </span>
          {NOTE_TYPE_DESCRIPTIONS[type] ? (
            <span
              className={`block text-xs mt-1 ${
                isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {NOTE_TYPE_DESCRIPTIONS[type]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default function WorkOrderNoteTypePicker({ open, onClose, onSelect, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';

  const handleSelect = (type) => {
    onSelect(type);
    onClose();
  };

  if (isMobile) {
    return (
      <MobileActionSheet open={open} onClose={onClose} title="Add note" zIndex={20060}>
        <TypeList onSelect={handleSelect} isMobile />
      </MobileActionSheet>
    );
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Add note" size="sm">
      <TypeList onSelect={handleSelect} isMobile={false} />
    </Modal>
  );
}

export function WorkOrderNoteTypePickerButton({ onClick, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={className}>
      <FaClipboardList className="mr-2" />
      Add note
    </button>
  );
}
