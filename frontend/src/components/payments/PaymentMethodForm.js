import { useState } from 'react';
import { useForm } from '@/hooks/useForm';
import { TextInput, SelectInput, Button } from '@/components/ui/FormElements';
import { FaSave, FaTimes, FaCreditCard, FaUniversity } from 'react-icons/fa';

export default function PaymentMethodForm({ onCancel, onSubmit, isSubmitting }) {
  const [paymentType, setPaymentType] = useState('credit_card');
  
  // Initialize form with default values
  const initialValues = {
    type: 'credit_card',
    nickname: '',
    last_four: '',
    expiry_date: '',
    is_default: false
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.type) {
      errors.type = 'Payment type is required';
    }
    
    if (values.type === 'credit_card') {
      if (!values.last_four) {
        errors.last_four = 'Last 4 digits are required';
      } else if (!/^\d{4}$/.test(values.last_four)) {
        errors.last_four = 'Must be 4 digits';
      }
      
      if (!values.expiry_date) {
        errors.expiry_date = 'Expiration date is required';
      } else if (!/^\d{2}\/\d{4}$/.test(values.expiry_date)) {
        errors.expiry_date = 'Must be in MM/YYYY format';
      }
    }
    
    if (values.type === 'bank_account') {
      if (!values.last_four) {
        errors.last_four = 'Last 4 digits are required';
      } else if (!/^\d{4}$/.test(values.last_four)) {
        errors.last_four = 'Must be 4 digits';
      }
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Error creating payment method:', error);
      // Set form error
      form.setErrors({
        _form: error.message || 'Failed to create payment method. Please try again.'
      });
    }
  };
  
  const form = useForm(initialValues, handleSubmit, validate);
  
  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setPaymentType(newType);
    form.handleChange(e);
  };
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <SelectInput
        label="Payment Method Type"
        name="type"
        value={form.values.type}
        onChange={handleTypeChange}
        onBlur={form.handleBlur}
        error={form.touched.type && form.errors.type}
        options={[
          { value: 'credit_card', label: 'Credit Card' },
          { value: 'bank_account', label: 'Bank Account' },
          { value: 'paypal', label: 'PayPal' },
          { value: 'other', label: 'Other' }
        ]}
        required
      />
      
      <TextInput
        label="Nickname (Optional)"
        name="nickname"
        value={form.values.nickname}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.nickname && form.errors.nickname}
        placeholder="e.g., Business Credit Card"
      />
      
      {(paymentType === 'credit_card' || paymentType === 'bank_account') && (
        <TextInput
          label="Last 4 Digits"
          name="last_four"
          value={form.values.last_four}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.last_four && form.errors.last_four}
          placeholder="1234"
          maxLength={4}
          pattern="\d{4}"
          required
        />
      )}
      
      {paymentType === 'credit_card' && (
        <TextInput
          label="Expiry Date"
          name="expiry_date"
          value={form.values.expiry_date}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.expiry_date && form.errors.expiry_date}
          placeholder="MM/YYYY"
          required
        />
      )}
      
      <div className="flex items-center">
        <input
          id="is_default"
          name="is_default"
          type="checkbox"
          checked={form.values.is_default}
          onChange={form.handleChange}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
          Set as default payment method
        </label>
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
          icon={<FaTimes />}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={form.isSubmitting || isSubmitting}
          disabled={form.isSubmitting || isSubmitting}
          icon={<FaSave />}
        >
          Save Payment Method
        </Button>
      </div>
    </form>
  );
}