import { useState } from 'react';
import { useForm } from '@/hooks/useForm';
import { TextInput, TextareaInput, Button } from '@/components/ui/FormElements';
import { FaSave, FaTimes } from 'react-icons/fa';

export default function RefundForm({ payment, onCancel, onSubmit, isSubmitting }) {
  // Initialize form with default values
  const initialValues = {
    amount: payment?.amount?.toString() || '0',
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
      errors.amount = `Amount cannot exceed the payment amount of ${payment.amount.toFixed(2)}`;
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    try {
      await onSubmit({
        amount: parseFloat(values.amount),
        reason: values.reason
      });
    } catch (error) {
      console.error('Error processing refund:', error);
      // Set form error
      form.setErrors({
        _form: error.message || 'Failed to process refund. Please try again.'
      });
    }
  };
  
  const form = useForm(initialValues, handleSubmit, validate);
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm text-gray-700 mb-4">
          You are about to refund payment: <strong>{payment.payment_number}</strong>
        </p>
        <p className="text-sm text-gray-700 mb-4">
          Original payment amount: <strong>${payment.amount.toFixed(2)}</strong>
        </p>
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
        placeholder="Describe the reason for this refund"
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
              <h3 className="text-sm font-medium text-red-800">Refund error</h3>
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
          variant="danger"
          isLoading={form.isSubmitting || isSubmitting}
          disabled={form.isSubmitting || isSubmitting}
          icon={<FaSave />}
        >
          Process Refund
        </Button>
      </div>
    </form>
  );
}