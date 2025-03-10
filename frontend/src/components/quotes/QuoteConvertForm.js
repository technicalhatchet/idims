import { useState } from 'react';
import { useForm } from '@/hooks/useForm';
import { SelectInput, TextInput, Button } from '@/components/ui/FormElements';
import { FaSave, FaTimes, FaExchangeAlt } from 'react-icons/fa';

export default function QuoteConvertForm({ quote, onCancel, onSubmit, isSubmitting }) {
  const [convertType, setConvertType] = useState('work_order');
  
  // Initialize form with default values
  const defaultWorkOrderValues = {
    scheduled_start: '',
    scheduled_end: '',
    technician_id: ''
  };
  
  const defaultInvoiceValues = {
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0] // 30 days from now
  };
  
  const initialValues = {
    convert_to: 'work_order',
    ...defaultWorkOrderValues,
    ...defaultInvoiceValues
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (values.convert_to === 'work_order') {
      if (!values.scheduled_start) {
        errors.scheduled_start = 'Start time is required';
      }
    } else if (values.convert_to === 'invoice') {
      if (!values.issue_date) {
        errors.issue_date = 'Issue date is required';
      }
      
      if (!values.due_date) {
        errors.due_date = 'Due date is required';
      }
      
      if (values.issue_date && values.due_date && new Date(values.due_date) < new Date(values.issue_date)) {
        errors.due_date = 'Due date must be after issue date';
      }
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    try {
      let submissionData = {
        convert_to: values.convert_to
      };
      
      if (values.convert_to === 'work_order') {
        submissionData = {
          ...submissionData,
          scheduled_start: values.scheduled_start ? new Date(values.scheduled_start).toISOString() : undefined,
          scheduled_end: values.scheduled_end ? new Date(values.scheduled_end).toISOString() : undefined,
          technician_id: values.technician_id || undefined
        };
      } else if (values.convert_to === 'invoice') {
        submissionData = {
          ...submissionData,
          issue_date: values.issue_date ? new Date(values.issue_date).toISOString() : undefined,
          due_date: values.due_date ? new Date(values.due_date).toISOString() : undefined
        };
      }
      
      await onSubmit(submissionData);
    } catch (error) {
      console.error('Error converting quote:', error);
      // Set form error
      form.setErrors({
        _form: error.message || 'Failed to convert quote. Please try again.'
      });
    }
  };
  
  const form = useForm(initialValues, handleSubmit, validate);
  
  // Handle convert type change
  const handleConvertTypeChange = (e) => {
    const newType = e.target.value;
    setConvertType(newType);
    form.handleChange(e);
  };
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm text-gray-700 mb-4">
          You are about to convert quote: <strong>{quote.quote_number}</strong>
        </p>
        <p className="text-sm text-gray-700 mb-4">
          Total amount: <strong>${quote.total.toFixed(2)}</strong>
        </p>
      </div>
      
      <SelectInput
        label="Convert To"
        name="convert_to"
        value={form.values.convert_to}
        onChange={handleConvertTypeChange}
        onBlur={form.handleBlur}
        error={form.touched.convert_to && form.errors.convert_to}
        options={[
          { value: 'work_order', label: 'Work Order' },
          { value: 'invoice', label: 'Invoice' }
        ]}
        required
      />
      
      {convertType === 'work_order' && (
        <div className="space-y-4">
          <TextInput
            label="Scheduled Start Time"
            name="scheduled_start"
            type="datetime-local"
            value={form.values.scheduled_start}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.scheduled_start && form.errors.scheduled_start}
            required
          />
          
          <TextInput
            label="Scheduled End Time (Optional)"
            name="scheduled_end"
            type="datetime-local"
            value={form.values.scheduled_end}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.scheduled_end && form.errors.scheduled_end}
          />
          
          <SelectInput
            label="Technician (Optional)"
            name="technician_id"
            value={form.values.technician_id}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.technician_id && form.errors.technician_id}
            options={[]} // This would be populated from an API call
            emptyOption="Select Technician..."
          />
        </div>
      )}
      
      {convertType === 'invoice' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInput
            label="Issue Date"
            name="issue_date"
            type="date"
            value={form.values.issue_date}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.issue_date && form.errors.issue_date}
            required
          />
          
          <TextInput
            label="Due Date"
            name="due_date"
            type="date"
            value={form.values.due_date}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.due_date && form.errors.due_date}
            required
          />
        </div>
      )}
      
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
              <h3 className="text-sm font-medium text-red-800">Conversion error</h3>
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
          isLoading={form.isSubmitting || isSubmitting}
          disabled={form.isSubmitting || isSubmitting}
          icon={<FaExchangeAlt />}
        >
          Convert Quote
        </Button>
      </div>
    </form>
  );
}