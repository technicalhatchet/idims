import { FaSearch, FaThList, FaTh } from 'react-icons/fa';
import { SORT_OPTIONS, STATUS_FILTERS } from './appliancesPageUtils';

const selectClass =
  'h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 text-xs focus:outline-none focus:border-cyan-500/40 min-w-0';

export default function AppliancesToolbar({
  search,
  onSearchChange,
  propertyFilter,
  onPropertyFilterChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  propertyOptions,
  typeOptions,
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="relative flex-1 min-w-0">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search appliances..."
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/40"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={propertyFilter}
          onChange={(e) => onPropertyFilterChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by property"
        >
          <option value="all">All Properties</option>
          {propertyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className={selectClass}
          aria-label="Filter by type"
        >
          <option value="all">All Types</option>
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className={selectClass}
          aria-label="Sort appliances"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-white/10 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`h-9 px-3 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-cyan-500/15 text-cyan-300 border-r border-white/10'
                : 'bg-white/[0.03] text-gray-400 hover:text-gray-200'
            }`}
          >
            <FaThList className="w-3 h-3" /> List
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={`h-9 px-3 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              viewMode === 'grid'
                ? 'bg-cyan-500/15 text-cyan-300'
                : 'bg-white/[0.03] text-gray-400 hover:text-gray-200'
            }`}
          >
            <FaTh className="w-3 h-3" /> Grid
          </button>
        </div>
      </div>
    </div>
  );
}
