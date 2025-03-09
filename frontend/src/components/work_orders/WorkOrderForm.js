import { useForm } from '@/hooks/useForm';
import { TextInput, SelectInput, TextareaInput, Checkbox, Button } from '@/components/ui/FormElements';
import { FaSave, FaTimes } from 'react-icons/fa';
import { useWorkOrderMutations } from '@/hooks/useWorkOrders';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/fetchWithAuth';
import { format } from 'date-fns';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';

export default function WorkOrderForm({ initialData, isEdit = false }) {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { createWorkOrder, updateWorkOrder, isLoading: isMutating } = useWorkOrderMutations();
  
  // Initialize form with default values or provided data
  const defaultValues = {
    client_id: '',
    title: '',
    description: '',
    priority: 'medium',
    scheduled_start: '',
    scheduled_end: '',
    assigned_technician_id: '',
    service_location: { address: '' },
    services: [],
    is_recurring: false
  };
  
  // Format date for form input
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '' : format(date, "yyyy-MM-dd'T'HH:mm");
  };
  
  // Prepare initial form values
  const getInitialValues = () => {
    if (!initialData) return defaultValues;
    
    return {
      client_id: initialData.client_id || '',
      title: initialData.title || '',
      description: initialData.description || '',
      priority: initialData.priority || 'medium',
      scheduled_start: formatDateForInput(initialData.scheduled_start),
      scheduled_end: formatDateForInput(initialData.scheduled_end),
      assigned_technician_id: initialData.assigned_technician_id || '',
      service_location: initialData.service_location || { address: '' },
      services: initialData.services || [],
      is_recurring: initialData.is_recurring || false
    };
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (!values.client_id) {
      errors.client_id = 'Client is required';
    }
    
    if (!values.title) {
      errors.title = 'Title is required';
    }
    
    if (!values.scheduled_start) {
      errors.scheduled_start = 'Start time is required';
    }
    
    if (values.scheduled_start && values.scheduled_end && 
        new Date(values.scheduled_end) <= new Date(values.scheduled_start)) {
      errors.scheduled_end = 'End time must be after start time';
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    const formattedValues = {
      ...values,
      service_location: values.service_location || { address: '' }
    };
    
    try {
      if (isEdit && initialData?.id) {
        await updateWorkOrder({
          id: initialData.id,
          data: formattedValues
        });
        
        router.push(`/work-orders/${initialData.id}`);
      } else {
        const newWorkOrder = await createWorkOrder(formattedValues);
        router.push(`/work-orders/${newWorkOrder.id}`);
      }
    } catch (error) {
      console.error('Error saving work order:', error);
      throw error;
    }
  };
  
  const form = useForm(getInitialValues(), handleSubmit, validate);
  
  // Load reference data
  useEffect(() => {
    const loadReferenceData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const [clientsData, techniciansData, servicesData] = await Promise.all([
          apiClient('/api/clients?limit=100'),
          apiClient('/api/technicians?limit=100'),
          apiClient('/api/services?limit=100')
        ]);
        
        setClients(
          clientsData?.items?.map(client => ({
            value: client.id,
            label: client.company_name || `${client.first_name} ${client.last_name}`
          })) || []
        );
        
        setTechnicians(
          techniciansData?.items?.map(tech => ({
            value: tech.id,
            label: `${tech.user?.first_name} ${tech.user?.last_name}`
          })) || []
        );
        
        setServices(
          servicesData?.items?.map(service => ({
            value: service.id,
            label: service.name,
            description: service.description,
            price: service.base_price
          })) || []
        );
      } catch (error) {
        console.error('Error loading reference data:', error);
        setError('Failed to load form data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadReferenceData();
  }, []);
  
  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }
  
  if (error) {
    return <ErrorAlert message={error} onRetry={() => router.reload()} />;
  }
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      {/* Client and basic info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectInput
          label="Client"
          name="client_id"
          value={form.values.client_id}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.client_id && form.errors.client_id}
          options={clients}
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
          placeholder="Brief description of the job"
        />
      </div>
      
      {/* Scheduling */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TextInput
          label="Start Time"
          name="scheduled_start"
          type="datetime-local"
          value={form.values.scheduled_start}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.scheduled_start && form.errors.scheduled_start}
          required
        />
        
        <TextInput
          label="End Time"
          name="scheduled_end"
          type="datetime-local"
          value={form.values.scheduled_end}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.scheduled_end && form.errors.scheduled_end}
          helpText="Optional if duration is unknown"
        />
      </div>
      
      {/* Technician and priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectInput
          label="Assigned Technician"
          name="assigned_technician_id"
          value={form.values.assigned_technician_id}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.assigned_technician_id && form.errors.assigned_technician_id}
          options={technicians}
          emptyOption="Select Technician..."
        />
        
        <SelectInput
          label="Priority"
          name="priority"
          value={form.values.priority}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.priority && form.errors.priority}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' }
          ]}
        />
      </div>
      
      {/* Location */}
      <TextInput
        label="Service Location"
        name="service_location.address"
        value={form.values.service_location?.address || ''}
        onChange={(e) => {
          form.setFormValues({
            service_location: {
              ...form.values.service_location,
              address: e.target.value
            }
          });
        }}
        onBlur={form.handleBlur}
        error={form.touched['service_location.address'] && form.errors['service_location.address']}
        placeholder="Full address where service will be performed"
      />
      
      {/* Description */}
      <TextareaInput
        label="Description"
        name="description"
        value={form.values.description}
        onChange={form.handleChange}
        onBlur={form.handleBlur}
        error={form.touched.description && form.errors.description}
        rows={4}
        placeholder="Detailed description of the problem and requirements"
      />
      
      {/* Recurring job option */}
      <Checkbox
        label="This is a recurring job"
        name="is_recurring"
        checked={form.values.is_recurring}
        onChange={form.handleChange}
        helpText="Check if this work order should repeat on a schedule"
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
          isLoading={form.isSubmitting || isMutating}
          disabled={form.isSubmitting || isMutating}
          icon={<FaSave />}
        >
          {isEdit ? 'Update' : 'Create'} Work Order
        </Button>
      </div>
    </form>
  );
}