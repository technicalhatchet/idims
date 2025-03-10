import { useState, useEffect } from 'react';
import { useForm } from '@/hooks/useForm';
import { TextInput, SelectInput, TextareaInput, Button } from '@/components/ui/FormElements';
import { FaSave, FaTimes, FaCreditCard, FaMoneyBill, FaCheck } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { apiClient } from '@/utils/fetchWithAuth';

export default function PaymentForm({ invoice = null, onComplete }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedClient, setSelectedClient] = useState(invoice?.client_id || '');
  
  // Initialize form with default values
  const initialValues = {
    invoice_id: invoice?.id || '',
    amount: invoice?.balance?.toString() || '',
    payment_method: 'credit_card',
    reference_number: '',
    notes: '',
    status: 'success'
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.invoice_id) {
      errors.invoice_id = 'Invoice is required';
    }
    
    if (!values.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(values.amount)) || parseFloat(values.amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    setIsSubmitting(true);
    
    try {
      const paymentData = {
        ...values,
        amount: parseFloat(values.amount)
      };
      
      const response = await apiClient('/api/payments', {
        method: 'POST',
        body: JSON.stringify(paymentData),
      });
      
      if (onComplete) {
        onComplete(response);
      } else {
        router.push(`/payments/${response.id}`);
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      // Set form error
      form.setErrors({
        _form: error.message || 'Failed to create payment. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const form = useForm(initialValues, handleSubmit, validate);
  
  // Load clients for dropdown
  useEffect(() => {
    const loadClients = async () => {
      setIsLoadingClients(true);
      
      try {
        const data = await apiClient('/api/clients?limit=100');
        
        setClients(data?.items?.map(client => ({
          value: client.id,
          label: client.company_name || `${client.first_name} ${client.last_name}`
        })) || []);
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        setIsLoadingClients(false);
      }
    };
    
    loadClients();
  }, []);
  
  // Load invoices for selected client
  useEffect(() => {
    const loadInvoices = async () => {
      if (!selectedClient) {
        setInvoices([]);
        return;
      }
      
      setIsLoadingInvoices(true);
      
      try {
        // Get open invoices for selected client
        const data = await apiClient(`/api/invoices?client_id=${selectedClient}&status=sent,overdue&limit=100`);
        
        setInvoices(data?.items?.map(invoice => ({
          value: invoice.id,
          label: `${invoice.invoice_number} ($${invoice.balance.toFixed(2)} due)`
        })) || []);
      } catch (error) {
        console.error('Error loading invoices:', error);
      } finally {
        setIsLoadingInvoices(false);
      }
    };
    
    loadInvoices();
  }, [selectedClient]);
  
  // Set invoice amount when invoice selection changes
  const handleInvoiceChange = async (e) => {
    const invoiceId = e.target.value;
    form.handleChange(e);
    
    if (!invoiceId) {
      form.setFormValues({ amount: '' });
      return;
    }
    
    try {
      const invoice = await apiClient(`/api/invoices/${invoiceId}`);
      form.setFormValues({ amount: invoice.balance.toString() });
    } catch (error) {
      console.error('Error loading invoice details:', error);
    }
  };
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {!invoice && (
          <SelectInput
            label="Client"
            name="client_id"
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              form.setFormValues({ invoice_id: '' });
            }}
            onBlur={form.handleBlur}
            error={form.touched.client_id && form.errors.client_id}
            options={clients}
            isLoading={isLoadingClients}
            emptyOption="Select Client..."
            required
          />
        )}
        
        <SelectInput
          label="Invoice"
          name="invoice_id"
          value={form.values.invoice_id}
          onChange={handleInvoiceChange}
          onBlur={form.handleBlur}
          error={form.touched.invoice_id && form.errors.invoice_id}
          options={invoices}
          isLoading={isLoadingInvoices}
          emptyOption="Select Invoice..."
          required
          disabled={!!invoice}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        
        <SelectInput
          label="Payment Method"
          name="payment_method"
          value={form.values.payment_method}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.payment_method && form.errors.payment_method}
          options={[
            { value: 'credit_card', label: 'Credit Card' },
            { value: 'cash', label: 'Cash' },
            { value: 'check', label: 'Check' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'paypal', label: 'PayPal' },
            { value: 'other', label: 'Other' }
          ]}
          required
        />
      </div>
      
      <TextInput
        label="Reference Number"
        name="reference_number"
        value={form.values.reference_number}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.reference_number && form.errors.reference_number}
        placeholder="Transaction ID, check number, etc."
      />
      
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
      
      <SelectInput
        label="Status"
        name="status"
        value={form.values.status}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.status && form.errors.status}
        options={[
          { value: 'success', label: 'Success' },
          { value: 'pending', label: 'Pending' }
        ]}
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
              <h3 className="text-sm font-medium text-red-800">Payment error</h3>
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
          Process Payment
        </Button>
      </div>
    </form>
  );
}