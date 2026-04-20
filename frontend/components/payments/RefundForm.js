import { useState } from 'react';
import { useForm } from '../../hooks/useForm';
import { TextInput, TextareaInput, Button } from '../../components/ui/FormElements';

export default function RefundForm({ payment, onCancel, onSubmit, isSubmitting }) {
  const [isFullRefund, setIsFullRefund] = useState(true);
  
  // Initialize form with default values
  const initialValues = {
    amount: payment?.amount || 0,
    reason: ''
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(values.amount)) || parseFloat(values.amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    } else if (parseFloat(values.amount) > payment.amount) {
      errors.amount = 'Refund amount cannot exceed the payment amount';
    }
    
    if (!values.reason) {
      errors.reason = 'Reason is required';
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Error processing refund:', error);
      // Set form error
      form.setErrors({
        _form: error.message || 'Failed to process refund. Please try again.'
      });
    }
  };
  
  const form = useForm(initialValues, handleSubmit, validate);
  
  const handleFullRefundToggle = (e) => {
    const fullRefund = e.target.checked;
    setIsFullRefund(fullRefund);
    
    if (fullRefund) {
      form.setFieldValue('amount', payment.amount);
    }
  };
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6 p-6">
      <div className="bg-gray-50 p-4 rounded-md mb-4">
        <div className="font-medium mb-2">Payment Information</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500 block">Payment #:</span>
            <span className="text-sm">{payment.payment_number}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 block">Original Amount:</span>
            <span className="text-sm font-medium">${payment.amount.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center">
        <input
          id="full-refund"
          name="full-refund"
          type="checkbox"
          checked={isFullRefund}
          onChange={handleFullRefundToggle}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="full-refund" className="ml-2 block text-sm text-gray-900">
          Full refund (${payment.amount.toFixed(2)})
        </label>
      </div>
      
      <TextInput
        label="Refund Amount"
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        max={payment.amount}
        value={form.values.amount}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.amount && form.errors.amount}
        disabled={isFullRefund}
        required
      />
      
      <TextareaInput
        label="Reason for Refund"
        name="reason"
        rows={3}
        value={form.values.reason}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.reason && form.errors.reason}
        placeholder="Please provide a reason for this refund"
        required
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
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="danger"
          isLoading={form.isSubmitting || isSubmitting}
          disabled={form.isSubmitting || isSubmitting}
        >
          Process Refund
        </Button>
      </div>
    </form>
  );
}