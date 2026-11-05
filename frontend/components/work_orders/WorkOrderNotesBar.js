import { LASER_BAR_HEIGHT_CSS, LaserBarStyles, usePressThenRun } from '../navigation/LaserBarParts';
import LaserFillBar from '../navigation/LaserFillBar';

/** Back | Add note | Photo, as even thirds like the other bars. */
const NOTES_DIVIDERS = [0.323, 0.677];

/**
 * Notes tab bottom bar. Same fin as the work order bar, note-focused actions.
 * (Closing the job lives on the status bar of the other tabs as "Close Job".)
 */
export default function WorkOrderNotesBar({ onBack, onAddNote, onAddPhoto }) {
  const [pressedKey, press] = usePressThenRun(260);

  const slices = [
    { key: 'back', role: 'back', icon: 'back', label: 'Back', ariaLabel: 'Back', onPress: onBack },
    {
      key: 'note',
      role: 'primary',
      tone: 'cyan',
      icon: 'note',
      label: 'Add Note',
      pressed: pressedKey === 'note',
      onPress: () => press('note', onAddNote),
    },
    { key: 'photo', role: 'side', tone: 'cyan', icon: 'photo', label: 'Photo', ariaLabel: 'Add photo', onPress: onAddPhoto },
  ];

  return (
    <div
      className="lb-root md:hidden fixed inset-x-0 bottom-0 z-[1188]"
      style={{ height: LASER_BAR_HEIGHT_CSS, transform: 'translateZ(0)' }}
      data-touch-surface
    >
      <LaserBarStyles />
      <nav aria-label="Note actions" style={{ position: 'absolute', inset: 0 }}>
        <LaserFillBar idPrefix="wo-notes-bar" slices={slices} dividers={NOTES_DIVIDERS} />
      </nav>
    </div>
  );
}
