import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from '../../hooks/useForm';
import { useClients } from '../../hooks/useClients';
import { usePaymentMutations } from '../../hooks/usePayments';
import { TextInput, SelectInput, TextareaInput, Button } from '../ui/FormElements';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorAlert from '../ui/ErrorAlert';

export default function PaymentForm({ invoiceId = null, clientId = null }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Fetch clients for the dropdown
  const { data: clientsData, isLoading: isLoadingClients, error: clientsError } = useClients();
  
  // Get payment mutations
  const { createPayment, isLoading: isMutationLoading } = usePaymentMutations();

  // Initialize form with default values
  const initialValues = {
    client_id: clientId || '',
    invoice_id: invoiceId || '',
    amount: '',
    payment_method: '',
    reference_number: '',
    notes: ''
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.client_id) {
      errors.client_id = 'Client is required';
    }
    
    if (!values.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(values.amount)) || parseFloat(values.amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    }
    
    if (!values.payment_method) {
      errors.payment_method = 'Payment method is required';
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    setIsProcessing(true);
    
    try {
      const result = await createPayment({
        client_id: values.client_id,
        invoice_id: values.invoice_id || null,
        amount: parseFloat(values.amount),
        payment_method: values.payment_method,
        reference_number: values.reference_number,
        notes: values.notes
      });
      
      // Redirect to the payment details page
      router.push(`/payments/${result.id}`);
    } catch (error) {
      console.error('Error creating payment:', error);
      form.setErrors({
        _form: error.message || 'Failed to process payment. Please try again.'
      });
      setIsProcessing(false);
    }
  };
  
  const form = useForm(initialValues, handleSubmit, validate);
  
  // Set client and invoice if provided in props
  useEffect(() => {
    if (clientId) {
      form.setFormValues({ client_id: clientId });
    }
    if (invoiceId) {
      form.setFormValues({ invoice_id: invoiceId });
    }
  }, [clientId, invoiceId]);
  
  if (isLoadingClients) {
    return <LoadingSpinner />;
  }
  
  if (clientsError) {
    return <ErrorAlert message="Failed to load clients" />;
  }
  
  const paymentMethods = [
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'other', label: 'Other' }
  ];
  
  const clientOptions = clientsData?.items?.map(client => ({
    value: client.id,
    label: client.company_name || `${client.first_name} ${client.last_name}`
  })) || [];
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      {/* Client selection */}
      <SelectInput
        label="Client"
        name="client_id"
        options={clientOptions}
        value={form.values.client_id}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.client_id && form.errors.client_id}
        required
        disabled={!!clientId}
      />
      
      {/* Invoice ID (optional) */}
      <TextInput
        label="Invoice ID (optional)"
        name="invoice_id"
        value={form.values.invoice_id}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.invoice_id && form.errors.invoice_id}
        disabled={!!invoiceId}
        helpText="Leave blank if this is not associated with an invoice"
      />
      
      {/* Amount */}
      <TextInput
        label="Amount"
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        value={form.values.amount}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.amount && form.errors.amount}
        required
      />
      
      {/* Payment Method */}
      <SelectInput
        label="Payment Method"
        name="payment_method"
        options={paymentMethods}
        value={form.values.payment_method}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.payment_method && form.errors.payment_method}
        required
      />
      
      {/* Reference Number */}
      <TextInput
        label="Reference Number"
        name="reference_number"
        value={form.values.reference_number}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.reference_number && form.errors.reference_number}
        helpText="Reference number for this payment (e.g., check number, transaction ID)"
      />
      
      {/* Notes */}
      <TextareaInput
        label="Notes"
        name="notes"
        rows={3}
        value={form.values.notes}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.notes && form.errors.notes}
        placeholder="Additional notes about this payment"
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
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={form.isSubmitting || isProcessing || isMutationLoading}
          disabled={form.isSubmitting || isProcessing || isMutationLoading}
        >
          Process Payment
        </Button>
      </div>
    </form>
  );
}