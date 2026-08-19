import { useState, useEffect, useRef } from 'react';
import { FaBoxes } from 'react-icons/fa';
import { getInventoryItems } from '../../services/api/inventoryApi';

/**
 * Search shop inventory and pick a SKU to link to a work-order part line.
 */
export default function InventorySkuPicker({ onSelect, disabled = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getInventoryItems({ search: query.trim(), limit: 12 });
        setResults(data?.items || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handlePick = (item) => {
    onSelect?.(item);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300/90">
        <FaBoxes className="w-3.5 h-3.5" />
        Pull from shop stock
      </div>
      <input
        type="search"
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search inventory SKU or name…"
        className="w-full rounded-lg border border-white/15 bg-[#0B1120] px-3 py-2 text-sm text-white placeholder:text-gray-500 disabled:opacity-50"
      />
      {loading && <p className="text-xs text-gray-500">Searching…</p>}
      {open && results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#0B1120] divide-y divide-white/5">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handlePick(item)}
                className="w-full text-left px-3 py-2 hover:bg-white/5"
              >
                <p className="text-sm text-white font-medium truncate">
                  {item.sku ? `${item.sku} — ${item.name}` : item.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.quantity_in_stock} on hand
                  {item.location ? ` · ${item.location}` : ''}
                  {item.is_low_stock ? ' · low' : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-gray-500">No matching inventory items.</p>
      )}
    </div>
  );
}
