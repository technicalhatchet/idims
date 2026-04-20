import { useState, useEffect } from 'react';
import { SelectInput, TextInput, Button } from '../ui/FormElements';
import Modal from '../ui/Modal';

export default function ReportFilters({ isOpen, onClose, filters, onFilterChange }) {
  const [localFilters, setLocalFilters] = useState(filters || {});

  // Update local filters when external filters change
  useEffect(() => {
    setLocalFilters(filters || {});
  }, [filters]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onFilterChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {};
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
    onClose();
  };

  const reportTypes = [
    { value: 'sales', label: 'Sales Report' },
    { value: 'revenue', label: 'Revenue Report' },
    { value: 'client', label: 'Client Report' },
    { value: 'technician', label: 'Technician Report' },
    { value: 'inventory', label: 'Inventory Report' },
    { value: 'work_order', label: 'Work Order Report' }
  ];

  const dateRanges = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_quarter', label: 'This Quarter' },
    { value: 'this_year', label: 'This Year' },
    { value: 'last_year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Reports"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <SelectInput
          label="Report Type"
          name="reportType"
          value={localFilters.reportType || ''}
          onChange={handleChange}
          options={reportTypes}
          emptyOption="All Types"
        />

        <SelectInput
          label="Date Range"
          name="dateRange"
          value={localFilters.dateRange || ''}
          onChange={handleChange}
          options={dateRanges}
          emptyOption="All Time"
        />

        {localFilters.dateRange === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Start Date"
              name="startDate"
              type="date"
              value={localFilters.startDate || ''}
              onChange={handleChange}
            />

            <TextInput
              label="End Date"
              name="endDate"
              type="date"
              value={localFilters.endDate || ''}
              onChange={handleChange}
            />
          </div>
        )}

        <TextInput
          label="Search Reports"
          name="searchTerm"
          type="text"
          value={localFilters.searchTerm || ''}
          onChange={handleChange}
          placeholder="Search by report name or description"
        />

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            type="submit"
            variant="primary"
          >
            Apply Filters
          </Button>
        </div>
      </form>
    </Modal>
  );
} 