import { useState } from 'react';
import { useForm } from '../../hooks/useForm';
import { TextInput, SelectInput, Checkbox, Button } from '../ui/FormElements';
import { FaSave, FaTimes } from 'react-icons/fa';

export default function ScheduleReportForm({ initialData, onSubmit, onCancel }) {
  const [selectedReportType, setSelectedReportType] = useState(initialData?.report_type || 'financial');
  const [selectedFrequency, setSelectedFrequency] = useState(initialData?.frequency || 'daily');
  
  // Default form values
  const defaultValues = {
    name: '',
    report_type: 'financial',
    frequency: 'daily',
    day_of_week: 'monday',
    day_of_month: '1',
    hour: '8',
    minute: '0',
    recipients: '',
    include_attachments: true,
    report_format: 'pdf',
    isActive: true
  };
  
  // Initialize with initial data or defaults
  const getInitialValues = () => {
    if (!initialData) return defaultValues;
    
    return {
      name: initialData.name || '',
      report_type: initialData.report_type || 'financial',
      frequency: initialData.frequency || 'daily',
      day_of_week: initialData.day_of_week || 'monday',
      day_of_month: initialData.day_of_month || '1',
      hour: initialData.hour || '8',
      minute: initialData.minute || '0',
      recipients: Array.isArray(initialData.recipients) 
        ? initialData.recipients.join(', ') 
        : initialData.recipients || '',
      include_attachments: initialData.include_attachments ?? true,
      report_format: initialData.report_format || 'pdf',
      isActive: initialData.isActive ?? true
    };
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.name) {
      errors.name = 'Schedule name is required';
    }
    
    if (!values.report_type) {
      errors.report_type = 'Report type is required';
    }
    
    if (!values.frequency) {
      errors.frequency = 'Frequency is required';
    }
    
    if (!values.recipients) {
      errors.recipients = 'At least one recipient is required';
    } else {
      // Check email format
      const emails = values.recipients.split(',').map(email => email.trim());
      const invalidEmails = emails.filter(email => !isValidEmail(email));
      
      if (invalidEmails.length > 0) {
        errors.recipients = `Invalid email format: ${invalidEmails.join(', ')}`;
      }
    }
    
    return errors;
  };
  
  // Validate email format
  const isValidEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };
  
  // Handle form submission
  const handleSubmit = async (values) => {
    try {
      // Format recipients as array
      const formattedValues = {
        ...values,
        recipients: values.recipients.split(',').map(email => email.trim())
      };
      
      await onSubmit(formattedValues);
    } catch (error) {
      console.error('Error saving schedule:', error);
      form.setErrors({
        _form: error.message || 'Failed to save schedule. Please try again.'
      });
    }
  };
  
  // Initialize the form
  const form = useForm(getInitialValues(), handleSubmit, validate);
  
  // Handle report type change
  const handleReportTypeChange = (e) => {
    setSelectedReportType(e.target.value);
    form.handleChange(e);
  };
  
  // Handle frequency change
  const handleFrequencyChange = (e) => {
    setSelectedFrequency(e.target.value);
    form.handleChange(e);
  };
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TextInput
          label="Schedule Name"
          name="name"
          value={form.values.name}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.name && form.errors.name}
          required
          placeholder="Monthly Financial Summary"
        />
        
        <SelectInput
          label="Report Type"
          name="report_type"
          value={form.values.report_type}
          onChange={handleReportTypeChange}
          onBlur={form.handleBlur}
          error={form.touched.report_type && form.errors.report_type}
          options={[
            { value: 'financial', label: 'Financial Report' },
            { value: 'operations', label: 'Operations Report' },
            { value: 'sales', label: 'Sales Report' },
            { value: 'customer', label: 'Customer Report' },
            { value: 'technician', label: 'Technician Performance' },
            { value: 'inventory', label: 'Inventory Report' }
          ]}
          required
        />
      </div>
      
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Schedule Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SelectInput
            label="Frequency"
            name="frequency"
            value={form.values.frequency}
            onChange={handleFrequencyChange}
            onBlur={form.handleBlur}
            error={form.touched.frequency && form.errors.frequency}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' }
            ]}
            required
          />
          
          {selectedFrequency === 'weekly' && (
            <SelectInput
              label="Day of Week"
              name="day_of_week"
              value={form.values.day_of_week}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.day_of_week && form.errors.day_of_week}
              options={[
                { value: 'monday', label: 'Monday' },
                { value: 'tuesday', label: 'Tuesday' },
                { value: 'wednesday', label: 'Wednesday' },
                { value: 'thursday', label: 'Thursday' },
                { value: 'friday', label: 'Friday' },
                { value: 'saturday', label: 'Saturday' },
                { value: 'sunday', label: 'Sunday' }
              ]}
              required
            />
          )}
          
          {selectedFrequency === 'monthly' && (
            <SelectInput
              label="Day of Month"
              name="day_of_month"
              value={form.values.day_of_month}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.day_of_month && form.errors.day_of_month}
              options={Array.from({ length: 31 }, (_, i) => ({ 
                value: String(i + 1), 
                label: String(i + 1) 
              }))}
              required
            />
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-6 mt-4">
          <SelectInput
            label="Hour"
            name="hour"
            value={form.values.hour}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.hour && form.errors.hour}
            options={Array.from({ length: 24 }, (_, i) => ({ 
              value: String(i), 
              label: i < 10 ? `0${i}:00` : `${i}:00` 
            }))}
            required
          />
          
          <SelectInput
            label="Minute"
            name="minute"
            value={form.values.minute}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.minute && form.errors.minute}
            options={[
              { value: '0', label: '00' },
              { value: '15', label: '15' },
              { value: '30', label: '30' },
              { value: '45', label: '45' }
            ]}
            required
          />
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Delivery Options</h3>
        
        <TextInput
          label="Recipients (comma-separated emails)"
          name="recipients"
          value={form.values.recipients}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.recipients && form.errors.recipients}
          placeholder="email@example.com, another@example.com"
          required
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <SelectInput
            label="Report Format"
            name="report_format"
            value={form.values.report_format}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.report_format && form.errors.report_format}
            options={[
              { value: 'pdf', label: 'PDF Document' },
              { value: 'excel', label: 'Excel Spreadsheet' },
              { value: 'csv', label: 'CSV File' }
            ]}
          />
          
          <div className="mt-4">
            <Checkbox
              label="Include Report as Attachment"
              name="include_attachments"
              checked={form.values.include_attachments}
              onChange={form.handleChange}
              helpText="If unchecked, recipients will receive a link to view the report online"
            />
            
            <Checkbox
              label="Active"
              name="isActive"
              checked={form.values.isActive}
              onChange={form.handleChange}
              helpText="Enable or disable this scheduled report"
              className="mt-4"
            />
          </div>
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
              <h3 className="text-sm font-medium text-red-800">Form submission error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{form.errors._form}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Form actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          icon={<FaTimes />}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={form.isSubmitting}
          disabled={form.isSubmitting}
          icon={<FaSave />}
        >
          {initialData ? 'Update' : 'Create'} Schedule
        </Button>
      </div>
    </form>
  );
} 