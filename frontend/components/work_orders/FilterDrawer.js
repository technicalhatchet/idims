import { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { SelectInput, TextInput, Button } from '@/components/ui/FormElements';

export default function FilterDrawer({ isOpen, onClose, filters, onFilterChange }) {
  const [localFilters, setLocalFilters] = useState(filters || {});
  
  // Update local filters when prop changes
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
  
  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onClose();
  };
  
  const handleResetFilters = () => {
    setLocalFilters({});
    onFilterChange({});
    onClose();
  };
  
  return (
    <div className={`fixed inset-0 overflow-hidden z-50 ${isOpen ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 overflow-hidden`}>
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-gray-500 ${isOpen ? 'bg-opacity-75' : 'bg-opacity-0'} transition-opacity duration-300`}
          onClick={onClose}
          aria-hidden="true"
        ></div>
        
        {/* Drawer */}
        <section
          className={`absolute inset-y-0 right-0 max-w-full flex outline-none ${isOpen ? 'transform-none' : 'translate-x-full'} transition duration-300 ease-in-out`}
          aria-labelledby="filter-heading"
        >
          <div className="relative w-screen max-w-md">
            <div className="h-full flex flex-col bg-white shadow-xl overflow-y-auto">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 id="filter-heading" className="text-lg font-medium text-gray-900">
                    Filters
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                    aria-label="Close filters"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
              
              {/* Filter content */}
              <div className="flex-1 p-6 space-y-6">
                <div className="space-y-4">
                  <SelectInput
                    label="Status"
                    name="status"
                    value={localFilters.status || ''}
                    onChange={handleChange}
                    options={[
                      { value: 'pending', label: 'Pending' },
                      { value: 'scheduled', label: 'Scheduled' },
                      { value: 'in_progress', label: 'In Progress' },
                      { value: 'on_hold', label: 'On Hold' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'cancelled', label: 'Cancelled' }
                    ]}
                    emptyOption="Any Status"
                  />
                  
                  <SelectInput
                    label="Priority"
                    name="priority"
                    value={localFilters.priority || ''}
                    onChange={handleChange}
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                      { value: 'urgent', label: 'Urgent' }
                    ]}
                    emptyOption="Any Priority"
                  />
                  
                  <TextInput
                    label="Start Date From"
                    name="start_date"
                    type="date"
                    value={localFilters.start_date || ''}
                    onChange={handleChange}
                  />
                  
                  <TextInput
                    label="Start Date To"
                    name="end_date"
                    type="date"
                    value={localFilters.end_date || ''}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              {/* Buttons */}
              <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleResetFilters}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleApplyFilters}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}