import { useState } from 'react';
import { useForm } from '../../hooks/useForm';
import { TextInput, SelectInput, DateRangePicker, Button } from '../ui/FormElements';
import { FaFilePdf, FaFileExcel, FaFileAlt, FaFileCsv, FaChartBar, FaChartPie, FaChartLine, FaTable, FaDownload, FaEye } from 'react-icons/fa';
import { format } from 'date-fns';

export default function ReportForm({ onSubmit, isSubmitting }) {
  const [reportType, setReportType] = useState('financial');
  
  // Default form values
  const defaultValues = {
    report_type: 'financial',
    report_subtype: 'summary',
    start_date: format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'), // First day of current month
    end_date: format(new Date(), 'yyyy-MM-dd'), // Today
    format: 'pdf',
    client_id: '',
    technician_id: '',
    inventory_category: '',
    include_charts: true,
    include_details: true
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.report_type) {
      errors.report_type = 'Report type is required';
    }
    
    if (!values.start_date) {
      errors.start_date = 'Start date is required';
    }
    
    if (!values.end_date) {
      errors.end_date = 'End date is required';
    }
    
    if (values.start_date && values.end_date && new Date(values.start_date) > new Date(values.end_date)) {
      errors.end_date = 'End date must be after start date';
    }
    
    if (values.report_type === 'client' && !values.client_id) {
      errors.client_id = 'Client is required for client reports';
    }
    
    if (values.report_type === 'technician' && !values.technician_id) {
      errors.technician_id = 'Technician is required for technician reports';
    }
    
    return errors;
  };
  
  // Handle form submission
  const handleSubmit = async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Error generating report:', error);
      form.setErrors({
        _form: error.message || 'Failed to generate report. Please try again.'
      });
    }
  };
  
  // Initialize form
  const form = useForm(defaultValues, handleSubmit, validate);
  
  // Handle report type change
  const handleReportTypeChange = (e) => {
    setReportType(e.target.value);
    form.handleChange(e);
  };
  
  // Get subtype options based on report type
  const getSubtypeOptions = () => {
    switch (reportType) {
      case 'financial':
        return [
          { value: 'summary', label: 'Summary' },
          { value: 'revenue', label: 'Revenue Analysis' },
          { value: 'expenses', label: 'Expense Breakdown' },
          { value: 'profitability', label: 'Profitability' }
        ];
      case 'operations':
        return [
          { value: 'workload', label: 'Work Order Summary' },
          { value: 'efficiency', label: 'Efficiency Metrics' },
          { value: 'completion', label: 'Completion Rates' },
          { value: 'scheduling', label: 'Scheduling Analysis' }
        ];
      case 'client':
        return [
          { value: 'activity', label: 'Activity History' },
          { value: 'spending', label: 'Spending Analysis' },
          { value: 'satisfaction', label: 'Satisfaction Metrics' }
        ];
      case 'technician':
        return [
          { value: 'performance', label: 'Performance Metrics' },
          { value: 'workload', label: 'Workload Analysis' },
          { value: 'efficiency', label: 'Efficiency' }
        ];
      case 'inventory':
        return [
          { value: 'usage', label: 'Usage Report' },
          { value: 'stock', label: 'Stock Levels' },
          { value: 'valuation', label: 'Inventory Valuation' }
        ];
      default:
        return [{ value: 'summary', label: 'Summary' }];
    }
  };
  
  // Get format icon based on format
  const getFormatIcon = (format) => {
    switch (format) {
      case 'pdf':
        return <FaFilePdf />;
      case 'excel':
        return <FaFileExcel />;
      case 'csv':
        return <FaFileCsv />;
      default:
        return <FaFileAlt />;
    }
  };
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      {/* Report Type Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Report Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { id: 'financial', label: 'Financial', icon: <FaChartLine className="h-6 w-6 mb-2" /> },
            { id: 'operations', label: 'Operations', icon: <FaChartBar className="h-6 w-6 mb-2" /> },
            { id: 'client', label: 'Client', icon: <FaChartPie className="h-6 w-6 mb-2" /> },
            { id: 'technician', label: 'Technician', icon: <FaTable className="h-6 w-6 mb-2" /> },
            { id: 'inventory', label: 'Inventory', icon: <FaFileAlt className="h-6 w-6 mb-2" /> }
          ].map((type) => (
            <div key={type.id}>
              <label
                className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer ${
                  reportType === type.id
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="report_type"
                  value={type.id}
                  checked={reportType === type.id}
                  onChange={handleReportTypeChange}
                  className="sr-only"
                />
                {type.icon}
                <span className="text-sm font-medium">{type.label}</span>
              </label>
            </div>
          ))}
        </div>
        
        {form.touched.report_type && form.errors.report_type && (
          <p className="mt-2 text-sm text-red-600">{form.errors.report_type}</p>
        )}
      </div>
      
      {/* Report Parameters */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Report Parameters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SelectInput
            label="Report Subtype"
            name="report_subtype"
            value={form.values.report_subtype}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.report_subtype && form.errors.report_subtype}
            options={getSubtypeOptions()}
          />
          
          <div className="flex flex-col space-y-2">
            <label className="block text-sm font-medium text-gray-700">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                label="From"
                name="start_date"
                type="date"
                value={form.values.start_date}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.touched.start_date && form.errors.start_date}
                hideLabel
              />
              <TextInput
                label="To"
                name="end_date"
                type="date"
                value={form.values.end_date}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.touched.end_date && form.errors.end_date}
                hideLabel
              />
            </div>
            {form.touched.end_date && form.errors.end_date && (
              <p className="text-sm text-red-600">{form.errors.end_date}</p>
            )}
          </div>
        </div>
        
        {reportType === 'client' && (
          <div className="mt-4">
            <SelectInput
              label="Client"
              name="client_id"
              value={form.values.client_id}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.client_id && form.errors.client_id}
              options={[]} // This would be populated with actual clients
              emptyOption="Select Client..."
              required
            />
          </div>
        )}
        
        {reportType === 'technician' && (
          <div className="mt-4">
            <SelectInput
              label="Technician"
              name="technician_id"
              value={form.values.technician_id}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.technician_id && form.errors.technician_id}
              options={[]} // This would be populated with actual technicians
              emptyOption="Select Technician..."
              required
            />
          </div>
        )}
        
        {reportType === 'inventory' && (
          <div className="mt-4">
            <SelectInput
              label="Inventory Category"
              name="inventory_category"
              value={form.values.inventory_category}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.inventory_category && form.errors.inventory_category}
              options={[]} // This would be populated with actual categories
              emptyOption="All Categories"
            />
          </div>
        )}
      </div>
      
      {/* Export Options */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Export Options</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['pdf', 'excel', 'csv'].map((format) => (
            <div key={format}>
              <label
                className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                  form.values.format === format
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={format}
                  checked={form.values.format === format}
                  onChange={form.handleChange}
                  className="sr-only"
                />
                <div className="mr-3">
                  {getFormatIcon(format)}
                </div>
                <span className="text-sm font-medium">
                  {format.toUpperCase()}
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Form-level error */}
      {form.errors._form && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error generating report</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{form.errors._form}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Form actions */}
      <div className="flex justify-end space-x-4">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          icon={<FaEye />}
        >
          Preview Report
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => form.handleSubmit({ ...form.values, download: true })}
          disabled={isSubmitting}
          icon={<FaDownload />}
        >
          Generate & Download
        </Button>
      </div>
    </form>
  );
} 