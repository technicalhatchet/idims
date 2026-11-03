import { FaClipboardList } from 'react-icons/fa';
import Modal from '../ui/Modal';
import MobileActionSheet from '../ui/MobileActionSheet';
import { MANUAL_NOTE_TYPES, NOTE_TYPE_DESCRIPTIONS, NOTE_TYPES, getNoteTypePickerLabel } from '../../constants/workOrderNoteTypes';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
// Orange accent for the callback / guided flows; everything else is cyan.
const ORANGE_TYPES = new Set([NOTE_TYPES.REDO, NOTE_TYPES.DIAGNOSTIC_RESULTS]);
const TYPE_TAGS = { [NOTE_TYPES.DIAGNOSTIC_RESULTS]: 'SOLOMON' };

/** Mobile laser rows: accent bar, label (+ tag), one-line description. */
function LaserTypeList({ onSelect }) {
  return (
    <div className="lsheet-stagger space-y-2">
      {MANUAL_NOTE_TYPES.map((type) => {
        const bar = ORANGE_TYPES.has(type) ? '#FF8A1F' : '#22D3EE';
        const tag = TYPE_TAGS[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className="lsheet-row flex w-full min-h-[62px] items-center gap-3 rounded-xl px-3 py-2.5 text-left touch-manipulation"
            style={{ border: '1px solid rgba(34, 211, 238, 0.2)', background: 'rgba(13, 22, 38, 0.72)' }}
          >
            <span aria-hidden="true" className="w-[3px] self-stretch rounded-sm" style={{ background: bar, boxShadow: `0 0 8px ${bar}` }} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#E6F6FA]">
                {getNoteTypePickerLabel(type)}
                {tag ? (
                  <span
                    className="rounded-[5px] px-1.5 py-0.5"
                    style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', background: 'rgba(255, 138, 31, 0.16)', color: '#FFB46B' }}
                  >
                    {tag}
                  </span>
                ) : null}
              </span>
              {NOTE_TYPE_DESCRIPTIONS[type] ? (
                <span className="mt-0.5 block text-xs leading-4 text-[#8A9FB4]">{NOTE_TYPE_DESCRIPTIONS[type]}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
      <MobileActionSheet open={open} onClose={onClose} title="Add note" kicker="WORK ORDER // NEW NOTE" zIndex={20060}>
        <LaserTypeList onSelect={handleSelect} />
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
