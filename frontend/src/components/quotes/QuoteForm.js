import { useState, useEffect } from 'react';
import { useForm } from '@/hooks/useForm';
import { TextInput, SelectInput, TextareaInput, Button } from '@/components/ui/FormElements';
import { FaSave, FaTimes, FaPlus, FaMinus, FaCalculator } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { apiClient } from '@/utils/fetchWithAuth';
import { useQuoteCalculator } from '@/hooks/useQuotes';

export default function QuoteForm({ initialData, isEdit = false }) {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [quoteItems, setQuoteItems] = useState([]);
  const [newItem, setNewItem] = useState({
    description: '',
    quantity: '1',
    unit_price: '0.00',
    tax_rate: '0',
    discount: '0',
    service_id: ''
  });
  
  // Quote calculator mutation
  const calculateMutation = useQuoteCalculator();
  
  // Initialize form with default values or provided data
  const defaultValues = {
    client_id: '',
    title: '',
    description: '',
    valid_until: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0], // 30 days from now
    terms: '',
    notes: '',
    status: 'draft'
  };
  
  // Prepare initial form values
  const getInitialValues = () => {
    if (!initialData) return defaultValues;
    
    return {
      client_id: initialData.client_id || '',
      title: initialData.title || '',
      description: initialData.description || '',
      valid_until: initialData.valid_until ? new Date(initialData.valid_until).toISOString().split('T')[0] : defaultValues.valid_until,
      terms: initialData.terms || '',
      notes: initialData.notes || '',
      status: initialData.status || 'draft'
    };
  };
  
  // Set up quote items from initial data
  useEffect(() => {
    if (initialData && initialData.items && initialData.items.length > 0) {
      setQuoteItems(initialData.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        tax_rate: item.tax_rate ? item.tax_rate.toString() : '0',
        discount: item.discount ? item.discount.toString() : '0',
        service_id: item.service_id || '',
        total: item.total
      })));
    }
  }, [initialData]);
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.client_id) {
      errors.client_id = 'Client is required';
    }
    
    if (!values.title) {
      errors.title = 'Title is required';
    }
    
    if (!values.valid_until) {
      errors.valid_until = 'Valid until date is required';
    } else if (new Date(values.valid_until) < new Date()) {
      errors.valid_until = 'Valid until date must be in the future';
    }
    
    if (quoteItems.length === 0) {
      errors._form = 'At least one item is required';
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    try {
      if (quoteItems.length === 0) {
        form.setErrors({ _form: 'At least one item is required' });
        return;
      }
      
      const quoteData = {
        ...values,
        items: quoteItems.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          tax_rate: parseFloat(item.tax_rate),
          discount: parseFloat(item.discount)
        }))
      };
      
      if (isEdit) {
        // Update existing quote
        await apiClient(`/api/quotes/${initialData.id}`, {
          method: 'PUT',
          body: JSON.stringify(quoteData),
        });
        
        router.push(`/quotes/${initialData.id}`);
      } else {
        // Create new quote
        const response = await apiClient('/api/quotes', {
          method: 'POST',
          body: JSON.stringify(quoteData),
        });
        
        router.push(`/quotes/${response.id}`);
      }
    } catch (error) {
      console.error('Error saving quote:', error);
      form.setErrors({
        _form: error.message || 'Failed to save quote. Please try again.'
      });
    }
  };
  
  const form = useForm(getInitialValues(), handleSubmit, validate);
  
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
  
  // Load services for dropdown
  useEffect(() => {
    const loadServices = async () => {
      setIsLoadingServices(true);
      
      try {
        const data = await apiClient('/api/services?limit=100');
        
        setServices(data?.items?.map(service => ({
          value: service.id,
          label: service.name,
          description: service.description,
          price: service.base_price
        })) || []);
      } catch (error) {
        console.error('Error loading services:', error);
      } finally {
        setIsLoadingServices(false);
      }
    };
    
    loadServices();
  }, []);
  
  // Handle input change for new item
  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem(prev => ({ ...prev, [name]: value }));
    
    // If service is selected, populate description and price
    if (name === 'service_id' && value) {
      const selectedService = services.find(s => s.value === value);
      if (selectedService) {
        setNewItem(prev => ({
          ...prev,
          service_id: value,
          description: selectedService.description || selectedService.label,
          unit_price: selectedService.price?.toString() || '0.00'
        }));
      }
    }
  };
  
  // Add new item to quote items
  const handleAddItem = async () => {
    // Validate new item
    if (!newItem.description || !newItem.quantity || !newItem.unit_price) {
      return; // Don't add invalid items
    }
    
    // Calculate item total
    let itemWithTotal = { ...newItem };
    
    try {
      // Use the calculator service to get the accurate total
      const result = await calculateMutation.mutateAsync({
        items: [
          {
            description: newItem.description,
            quantity: parseFloat(newItem.quantity),
            unit_price: parseFloat(newItem.unit_price),
            tax_rate: parseFloat(newItem.tax_rate || 0),
            discount: parseFloat(newItem.discount || 0)
          }
        ]
      });
      
      if (result && result.items && result.items[0]) {
        itemWithTotal.total = result.items[0].total;
      } else {
        // Simple calculation fallback
        const quantity = parseFloat(newItem.quantity);
        const unitPrice = parseFloat(newItem.unit_price);
        const taxRate = parseFloat(newItem.tax_rate || 0) / 100;
        const discount = parseFloat(newItem.discount || 0) / 100;
        
        const subtotal = quantity * unitPrice;
        const discountAmount = subtotal * discount;
        const taxableAmount = subtotal - discountAmount;
        const taxAmount = taxableAmount * taxRate;
        
        itemWithTotal.total = taxableAmount + taxAmount;
      }
      
      // Add to items array
      setQuoteItems(prev => [...prev, { ...itemWithTotal, id: `temp-${Date.now()}` }]);
      
      // Reset form for new item
      setNewItem({
        description: '',
        quantity: '1',
        unit_price: '0.00',
        tax_rate: '0',
        discount: '0',
        service_id: ''
      });
    } catch (error) {
      console.error('Error calculating item total:', error);
    }
  };
  
  // Remove item from quote items
  const handleRemoveItem = (index) => {
    setQuoteItems(prev => prev.filter((_, i) => i !== index));
  };
  
  // Calculate quote totals
  const calculateTotals = () => {
    const subtotal = quoteItems.reduce((sum, item) => sum + (item.total || 0), 0);
    return {
      subtotal,
      total: subtotal
    };
  };
  
  const totals = calculateTotals();
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectInput
          label="Client"
          name="client_id"
          value={form.values.client_id}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.client_id && form.errors.client_id}
          options={clients}
          isLoading={isLoadingClients}
          emptyOption="Select Client..."
          required
        />
        
        <TextInput
          label="Title"
          name="title"
          value={form.values.title}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.title && form.errors.title}
          required
          placeholder="Brief description of the quote"
        />
      </div>
      
      <TextareaInput
        label="Description"
        name="description"
        rows={3}
        value={form.values.description}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.description && form.errors.description}
        placeholder="Detailed description of the quote"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TextInput
          label="Valid Until"
          name="valid_until"
          type="date"
          value={form.values.valid_until}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.valid_until && form.errors.valid_until}
          required
        />
        
        <SelectInput
          label="Status"
          name="status"
          value={form.values.status}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.status && form.errors.status}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'sent', label: 'Sent' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'expired', label: 'Expired' }
          ]}
        />
      </div>
      
      {/* Quote Items Section */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quote Items</h3>
        
        {/* Item Table */}
        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax Rate %
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount %
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quoteItems.map((item, index) => (
                <tr key={item.id || index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${parseFloat(item.unit_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.tax_rate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.discount}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${item.total?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <FaMinus />
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* Add New Item Row */}
              <tr className="bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex flex-col space-y-2">
                    <SelectInput
                      name="service_id"
                      value={newItem.service_id}
                      onChange={handleItemChange}
                      options={services}
                      isLoading={isLoadingServices}
                      emptyOption="Select Service (Optional)"
                      className="mb-2"
                    />
                    <TextInput
                      name="description"
                      value={newItem.description}
                      onChange={handleItemChange}
                      placeholder="Description"
                      required
                    />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <TextInput
                    name="quantity"
                    type="number"
                    step="1"
                    min="1"
                    value={newItem.quantity}
                    onChange={handleItemChange}
                    placeholder="Qty"
                    required
                  />
                </td>
                <td className="px-6 py-4">
                  <TextInput
                    name="unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.unit_price}
                    onChange={handleItemChange}
                    placeholder="Price"
                    required
                  />
                </td>
                <td className="px-6 py-4">
                  <TextInput
                    name="tax_rate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={newItem.tax_rate}
                    onChange={handleItemChange}
                    placeholder="Tax %"
                  />
                </td>
                <td className="px-6 py-4">
                  <TextInput
                    name="discount"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={newItem.discount}
                    onChange={handleItemChange}
                    placeholder="Discount %"
                  />
                </td>
                <td className="px-6 py-4">
                  {/* Placeholder for total */}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-green-600 hover:text-green-900"
                  >
                    <FaPlus />
                  </button>
                </td>
              </tr>
            </tbody>
            
            {/* Totals Section */}
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan="5" className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  Subtotal:
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ${totals.subtotal.toFixed(2)}
                </td>
                <td></td>
              </tr>
              <tr>
                <td colSpan="5" className="px-6 py-4 text-right text-base font-bold text-gray-900">
                  Total:
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-gray-900">
                  ${totals.total.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TextareaInput
          label="Terms & Conditions"
          name="terms"
          rows={3}
          value={form.values.terms}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.terms && form.errors.terms}
          placeholder="Terms and conditions for this quote"
        />
        
        <TextareaInput
          label="Notes"
          name="notes"
          rows={3}
          value={form.values.notes}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.notes && form.errors.notes}
          placeholder="Additional notes for this quote"
        />
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
          onClick={() => router.back()}
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
          {isEdit ? 'Update' : 'Create'} Quote
        </Button>
      </div>
    </form>
  );
}