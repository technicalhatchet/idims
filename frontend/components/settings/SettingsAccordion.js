import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';

const STORAGE_KEY = 'idims-settings-accordion-v1';

const SettingsAccordionContext = createContext(null);

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function storageKey(tabId, sectionId) {
  return `${tabId}:${sectionId}`;
}

export function SettingsAccordionProvider({ tabId, sectionIds, children }) {
  const [storage, setStorage] = useState(loadStorage);

  const isOpen = useCallback(
    (sectionId) => Boolean(storage[storageKey(tabId, sectionId)]),
    [storage, tabId],
  );

  const toggle = useCallback(
    (sectionId) => {
      setStorage((prev) => {
        const key = storageKey(tabId, sectionId);
        const next = { ...prev, [key]: !prev[key] };
        saveStorage(next);
        return next;
      });
    },
    [tabId],
  );

  const setAll = useCallback(
    (open) => {
      setStorage((prev) => {
        const next = { ...prev };
        sectionIds.forEach((id) => {
          next[storageKey(tabId, id)] = open;
        });
        saveStorage(next);
        return next;
      });
    },
    [tabId, sectionIds],
  );

  const value = useMemo(
    () => ({ tabId, isOpen, toggle, setAll }),
    [tabId, isOpen, toggle, setAll],
  );

  return (
    <SettingsAccordionContext.Provider value={value}>
      {children}
    </SettingsAccordionContext.Provider>
  );
}

export function SettingsAccordionToolbar() {
  const ctx = useContext(SettingsAccordionContext);
  if (!ctx) return null;
  return (
    <div className="flex justify-end gap-2 mb-4">
      <button
        type="button"
        onClick={() => ctx.setAll(true)}
        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded border border-cyan-500/25"
      >
        Expand all
      </button>
      <button
        type="button"
        onClick={() => ctx.setAll(false)}
        className="text-xs font-medium text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-white/10"
      >
        Collapse all
      </button>
    </div>
  );
}

export function SettingsAccordion({ sectionId, title, summary, children }) {
  const ctx = useContext(SettingsAccordionContext);
  const open = ctx ? ctx.isOpen(sectionId) : false;
  const onToggle = () => ctx?.toggle(sectionId);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white m-0">{title}</h2>
          {summary ? <p className="text-xs text-gray-500 mt-1 mb-0">{summary}</p> : null}
        </div>
        <span className="text-gray-500 shrink-0 mt-1">
          {open ? <FaChevronDown className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}
        </span>
      </button>
      {open ? <div className="border-t border-white/[0.06]">{children}</div> : null}
    </div>
  );
}

export const SETTINGS_TAB_SECTIONS = {
  interface: ['display-name', 'nav-rail'],
  availability: ['shop-hours'],
  'client-portal': [
    'portal-feature-flags',
    'portal-scheduling',
    'portal-reviews',
    'portal-appliance-data',
  ],
  notifications: ['customer-outreach', 'worker-flags', 'push-notifications'],
  'service-areas': ['service-zones', 'drive-time-pricing'],
  tax: ['tax-settings'],
  parts: ['parts-settings', 'parts-lookup', 'parts-vendors'],
  'price-book': ['price-book-skus'],
};
