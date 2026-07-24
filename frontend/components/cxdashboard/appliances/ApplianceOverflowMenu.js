import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  FaHistory,
  FaFolderOpen,
  FaShieldAlt,
  FaEdit,
  FaTrash,
} from 'react-icons/fa';

const MENU_ITEMS = [
  { id: 'history', label: 'View Service History', icon: FaHistory, hrefKey: 'detail' },
  { id: 'documents', label: 'Documents', icon: FaFolderOpen, hrefKey: 'documents' },
  { id: 'warranty', label: 'Warranty Details', icon: FaShieldAlt, hrefKey: 'warranty' },
  { id: 'edit', label: 'Edit Appliance', icon: FaEdit, action: 'edit' },
  { id: 'remove', label: 'Remove Appliance', icon: FaTrash, action: 'remove', danger: true },
];

const MENU_WIDTH = 210;

export default function ApplianceOverflowMenu({
  open,
  onClose,
  anchorRef,
  appliance,
  detailHref,
  scheduleHref,
  onEdit,
  onRemove,
}) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef?.current) return undefined;

    const updatePosition = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const left = Math.min(
        Math.max(8, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8,
      );
      setPosition({ top: rect.bottom + 6, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (
        menuRef.current?.contains(event.target)
        || anchorRef?.current?.contains(event.target)
      ) {
        return;
      }
      onClose();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose, anchorRef]);

  const hrefFor = (item) => {
    if (item.hrefKey === 'detail') return detailHref;
    if (item.hrefKey === 'documents') return '/cxdashboard/documents';
    if (item.hrefKey === 'warranty') return '/cxdashboard/warranty';
    return scheduleHref;
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
          className="min-w-[210px] rounded-lg border border-white/10 bg-[#0B1220] shadow-xl shadow-black/40 py-1 overflow-hidden"
        >
          {MENU_ITEMS.map((item) => {
            if (item.action === 'edit') {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onEdit?.(appliance);
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/5 inline-flex items-center gap-2.5"
                >
                  <item.icon className="w-3.5 h-3.5 text-gray-400" />
                  {item.label}
                </button>
              );
            }

            if (item.action === 'remove') {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onRemove?.(appliance);
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 inline-flex items-center gap-2.5"
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={hrefFor(item)}
                onClick={onClose}
                className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/5 inline-flex items-center gap-2.5"
              >
                <item.icon className="w-3.5 h-3.5 text-gray-400" />
                {item.label}
              </Link>
            );
          })}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
