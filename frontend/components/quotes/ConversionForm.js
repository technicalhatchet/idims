import { useState } from 'react';
import { useForm } from '../../hooks/useForm';
import { TextInput, SelectInput, TextareaInput, Button, Checkbox } from '../ui/FormElements';
import { formatCurrency } from '../../utils/formatters';

export default function ConversionForm({ quote, onSubmit, onCancel, isSubmitting }) {
  const [conversionType, setConversionType] = useState('invoice');
  
  // Initialize form with default values
  const initialValues = {
    convert_to: 'invoice',
    include_all_line_items: true,
    adjust_tax: false,
    schedule_date: '',
    notes: ''
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.convert_to) {
      errors.convert_to = 'Please select conversion type';
    }
    
    if (values.convert_to === 'work_order' && !values.schedule_date) {
      errors.schedule_date = 'Please select a schedule date for the work order';
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Error converting quote:', error);
      form.setErrors({
        _form: error.message || 'Failed to convert quote. Please try again.'
      });
    }
  };
  
  const form = useForm(initialValues, handleSubmit, validate);
  
  // Handle conversion type change
  const handleConversionTypeChange = (e) => {
    const value = e.target.value;
    setConversionType(value);
    form.handleChange(e);
  };
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-md mb-4">
        <div className="font-medium mb-2">Quote Information</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500 block">Quote #:</span>
            <span className="text-sm">{quote.quote_number}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 block">Client:</span>
            <span className="text-sm">{quote.client.company_name || `${quote.client.first_name} ${quote.client.last_name}`}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 block">Amount:</span>
            <span className="text-sm font-medium">{formatCurrency(quote.total)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 block">Status:</span>
            <span className="text-sm">{quote.status}</span>
          </div>
        </div>
      </div>
      
      <SelectInput
        label="Convert To"
        name="convert_to"
        options={[
          { value: 'invoice', label: 'Invoice' },
          { value: 'work_order', label: 'Work Order' }
        ]}
        value={form.values.convert_to}
        onChange={handleConversionTypeChange}
        onBlur={form.handleBlur}
        error={form.touched.convert_to && form.errors.convert_to}
        required
      />
      
      <Checkbox
        label="Include all line items"
        name="include_all_line_items"
        checked={form.values.include_all_line_items}
        onChange={(e) => form.setFormValues({ include_all_line_items: e.target.checked })}
        helpText="Include all line items from the quote"
      />
      
      <Checkbox
        label="Recalculate tax"
        name="adjust_tax"
        checked={form.values.adjust_tax}
        onChange={(e) => form.setFormValues({ adjust_tax: e.target.checked })}
        helpText="Recalculate tax values based on current rates"
      />
      
      {conversionType === 'work_order' && (
        <TextInput
          label="Schedule Date"
          name="schedule_date"
          type="date"
          value={form.values.schedule_date}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.schedule_date && form.errors.schedule_date}
          helpText="The date when work is scheduled to begin"
          required
        />
      )}
      
      <TextareaInput
        label="Conversion Notes"
        name="notes"
        rows={3}
        value={form.values.notes}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.notes && form.errors.notes}
        placeholder="Any notes about this conversion"
      />
      
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
              <h3 className="text-sm font-medium text-red-800">Error</h3>
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
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={form.isSubmitting || isSubmitting}
          disabled={form.isSubmitting || isSubmitting}
        >
          Convert Quote
        </Button>
      </div>
    </form>
  );
} 