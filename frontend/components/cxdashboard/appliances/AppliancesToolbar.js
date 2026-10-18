import { useState } from 'react';
import { FaSearch, FaThList, FaTh, FaSlidersH } from 'react-icons/fa';
import { SORT_OPTIONS, STATUS_FILTERS, countActiveFilters } from './appliancesPageUtils';
import AppliancesFiltersSheet from './AppliancesFiltersSheet';

const selectClass =
  'h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 text-xs focus:outline-none focus:border-cyan-500/40 min-w-0';

const selectClassMobile =
  'flex-1 min-w-0 h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 text-sm focus:outline-none focus:border-cyan-500/40';

function ViewModeToggles({ viewMode, onViewModeChange, iconOnly = false }) {
  const listClass = viewMode === 'list'
    ? 'bg-cyan-500/15 text-cyan-300'
    : 'bg-white/[0.03] text-gray-400 hover:text-gray-200';
  const gridClass = viewMode === 'grid'
    ? 'bg-cyan-500/15 text-cyan-300'
    : 'bg-white/[0.03] text-gray-400 hover:text-gray-200';

  return (
    <div className="flex rounded-lg border border-white/10 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onViewModeChange('list')}
        className={`h-9 ${iconOnly ? 'w-9 px-0 justify-center' : 'px-3'} text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border-r border-white/10 ${listClass}`}
        aria-label="List view"
        title="List view"
      >
        <FaThList className="w-3.5 h-3.5" />
        {!iconOnly ? 'List' : null}
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange('grid')}
        className={`h-9 ${iconOnly ? 'w-9 px-0 justify-center' : 'px-3'} text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${gridClass}`}
        aria-label="Grid view"
        title="Grid view"
      >
        <FaTh className="w-3.5 h-3.5" />
        {!iconOnly ? 'Grid' : null}
      </button>
    </div>
  );
}

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
  onFindFromHistory,
  historySuggestionCount = 0,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = countActiveFilters({ statusFilter, typeFilter, sortBy });

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <div className="relative w-full min-w-0">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search appliances..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/40"
          />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <select
            value={propertyFilter}
            onChange={(e) => onPropertyFilterChange(e.target.value)}
            className={selectClassMobile}
            aria-label="Filter by property"
          >
            <option value="all">All properties</option>
            {propertyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative h-9 shrink-0 px-3 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-semibold text-gray-200 inline-flex items-center gap-1.5"
            aria-label="Open filters"
          >
            <FaSlidersH className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-cyan-500/25 text-cyan-200 text-[10px] font-bold inline-flex items-center justify-center">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          <ViewModeToggles viewMode={viewMode} onViewModeChange={onViewModeChange} iconOnly />
        </div>

        <div className="hidden lg:flex lg:flex-wrap lg:items-center gap-2">
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

          {onFindFromHistory ? (
            <button
              type="button"
              onClick={onFindFromHistory}
              className="h-9 px-3 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-semibold text-gray-300 hover:text-white inline-flex items-center gap-1.5 shrink-0"
              title="Find appliances from past work orders"
            >
              Service history
              {historySuggestionCount > 0 ? (
                <span className="min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold inline-flex items-center justify-center">
                  {historySuggestionCount}
                </span>
              ) : null}
            </button>
          ) : null}

          <ViewModeToggles viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </div>
      </div>

      <AppliancesFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        typeFilter={typeFilter}
        onTypeFilterChange={onTypeFilterChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        typeOptions={typeOptions}
        onFindFromHistory={onFindFromHistory}
        historySuggestionCount={historySuggestionCount}
      />
    </>
  );
}
