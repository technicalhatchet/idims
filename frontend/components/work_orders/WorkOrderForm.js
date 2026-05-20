import { useForm } from '../../hooks/useForm';
import { TextInput, SelectInput, TextareaInput, Checkbox, Button } from '../ui/FormElements';
import { FaSave, FaTimes, FaTrash, FaUserPlus } from 'react-icons/fa';
import { useWorkOrderMutations } from '../../hooks/useWorkOrders';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { apiClient } from '../../utils/api-client';
import { format } from 'date-fns';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Select from 'react-select';


// Constants for equipment types
const SYMPTOMS_BY_TYPE = {
  refrigerator: ['Not Cooling', 'Not Freezing', 'Ice Maker Broken', 'Leaking', 'Loud Noise', 'Won\'t Start', 'Frost Buildup', 'Door Seal Issue', 'Water Dispenser Broken', 'Temperature Fluctuating'],
  washing_machine: ['Won\'t Start', 'Won\'t Spin', 'Won\'t Drain', 'Leaking', 'Loud Noise', 'Won\'t Fill', 'Door Won\'t Lock', 'Shaking/Vibrating', 'Error Code', 'Won\'t Complete Cycle'],
  dryer: ['Won\'t Heat', 'Won\'t Start', 'Takes Too Long', 'Loud Noise', 'Won\'t Turn', 'Overheating', 'No Power', 'Shuts Off Early', 'Error Code', 'Door Won\'t Latch'],
  dishwasher: ['Won\'t Drain', 'Won\'t Fill', 'Not Cleaning', 'Leaking', 'Won\'t Start', 'Door Won\'t Latch', 'Loud Noise', 'Error Code', 'Not Drying', 'Cloudy Dishes'],
  oven: ['Won\'t Heat', 'Won\'t Ignite', 'Uneven Cooking', 'Door Won\'t Close', 'Error Code', 'Won\'t Self-Clean', 'Temperature Off', 'Burner Issue', 'Control Panel Issue', 'Won\'t Turn On'],
  microwave: ['Won\'t Heat', 'Sparking', 'Turntable Not Spinning', 'Door Won\'t Close', 'Loud Noise', 'Won\'t Start', 'Display Issue', 'Buttons Not Working'],
  freezer: ['Not Freezing', 'Frost Buildup', 'Loud Noise', 'Leaking', 'Won\'t Start', 'Door Seal Issue', 'Temperature Fluctuating'],
  tv: ['No Picture', 'No Sound', 'Won\'t Turn On', 'Remote Not Working', 'Lines on Screen', 'Flickering', 'No Signal', 'Cracked Screen', 'Backlight Issue', 'HDMI Not Working'],
};

// Map equipment_subtype to symptom keys
const SUBTYPE_TO_SYMPTOM_KEY = {
  refrigerator: 'refrigerator',
  washing_machine: 'washing_machine',
  dryer: 'dryer',
  dishwasher: 'dishwasher',
  oven: 'oven',
  range: 'oven',
  microwave: 'microwave',
  freezer: 'freezer',
};

const EQUIPMENT_TYPES = [
  { value: '', label: 'Select Equipment Type' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'tv', label: 'TV' }
];

// New constants for SKU selection
const SKU_EQUIPMENT_CATEGORIES = [
  { value: '', label: 'Select Main Category...' },
  { value: 'TV', label: 'TV' },
  { value: 'Appliance', label: 'Appliance' },
  { value: 'Network', label: 'Network' },
  // Add 'Other' if necessary, based on how 'other' equipment_type SKUs should be handled
];

const EQUIPMENT_CATEGORY_MAP = {
  TV: ['tv'],
  Appliance: ['washer', 'dryer', 'stacked_laundry', 'aio_laundry', 'refrigerator', 'dishwasher', 'range', 'wall_oven', 'other'], // Assuming 'other' equipment type maps to Appliance category
  Network: ['network'],
};

const SERVICE_TYPE_GROUP_LABELS = {
  diagnostic: 'Diagnostics',
  repair: 'Repairs',
  installation: 'Installations',
  custom: 'Custom Services',
  remote: 'Remote Services',
  additional_time: 'Additional Time',
  // Add other service_types if they need to be grouped and displayed
};

const SERVICE_TYPE_ORDER_MAP = {
  diagnostic: 1,
  repair: 2,
  installation: 3,
  custom: 4,
  remote: 5,
  additional_time: 6,
  // Define order for other types if they are included
};

// Equipment subtypes
const EQUIPMENT_SUBTYPES = {
  appliance: [
    { value: '', label: 'Select Appliance Type' },
    { value: 'refrigerator', label: 'Refrigerator' },
    { value: 'dishwasher', label: 'Dishwasher' },
    { value: 'washing_machine', label: 'Washing Machine' },
    { value: 'dryer', label: 'Dryer' },
    { value: 'oven', label: 'Oven' },
    { value: 'microwave', label: 'Microwave' },
    { value: 'cooktop', label: 'Cooktop' },
    { value: 'range_hood', label: 'Range Hood' },
    { value: 'other', label: 'Other' }
  ],
  tv: [
    { value: '', label: 'Select TV Size' },
    { value: 'under_32', label: 'Under 32"' },
    { value: '32_to_43', label: '32" to 43"' },
    { value: '44_to_55', label: '44" to 55"' },
    { value: '56_to_65', label: '56" to 65"' },
    { value: '66_to_75', label: '66" to 75"' },
    { value: 'over_75', label: 'Over 75"' }
  ]
};

// Common manufacturers
const MANUFACTURERS = [
  { value: '', label: 'Select Manufacturer' },
  { value: 'Samsung', label: 'Samsung' },
  { value: 'LG', label: 'LG' },
  { value: 'Sony', label: 'Sony' },
  { value: 'Whirlpool', label: 'Whirlpool' },
  { value: 'GE', label: 'GE' },
  { value: 'Frigidaire', label: 'Frigidaire' },
  { value: 'Maytag', label: 'Maytag' },
  { value: 'KitchenAid', label: 'KitchenAid' },
  { value: 'Bosch', label: 'Bosch' },
  { value: 'Kenmore', label: 'Kenmore' },
  { value: 'Electrolux', label: 'Electrolux' },
  { value: 'Haier', label: 'Haier' },
  { value: 'TCL', label: 'TCL' },
  { value: 'Hisense', label: 'Hisense' },
  { value: 'Vizio', label: 'Vizio' },
  { value: 'Other', label: 'Other' }
];

/** Technician list items use `user.first_name` / `user.last_name`; API does not send `name` or `full_name` on JSON. */
function formatTechnicianSelectLabel(t) {
  if (!t) return '';
  if (t.name) return t.name;
  if (t.user?.first_name || t.user?.last_name) {
    return [t.user.first_name, t.user.last_name].filter(Boolean).join(' ').trim();
  }
  if (t.first_name || t.last_name) {
    return [t.first_name, t.last_name].filter(Boolean).join(' ').trim();
  }
  if (t.employee_id) return `Technician (${t.employee_id})`;
  if (t.user?.email) return t.user.email;
  return String(t.id);
}

export default function WorkOrderForm({ initialData, isEdit = false, onUpdateSuccess }) {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [allServicesRaw, setAllServicesRaw] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientData, setClientData] = useState({}); // Store detailed client data for address auto-population
  const [success, setSuccess] = useState(false);
  const { createWorkOrder, createWorkOrderWithInitialAppointment, updateWorkOrder, isLoading: isMutating } = useWorkOrderMutations();

  /** Optional: create first appointment in the same transaction as the work order (new WOs only). 
  const [scheduleFirstVisit, setScheduleFirstVisit] = useState(false);
  const [firstVisitStart, setFirstVisitStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });
  const [firstVisitTechnicianId, setFirstVisitTechnicianId] = useState('');
  const [techniciansList, setTechniciansList] = useState([]);
  const [previewSlots, setPreviewSlots] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);*/
  
  // New state for SKU selection
  const [selectedSkuEquipmentCategory, setSelectedSkuEquipmentCategory] = useState('');
  const [filteredSkusForDropdown, setFilteredSkusForDropdown] = useState([]);

  // New client inline form state
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [newClientError, setNewClientError] = useState(null);

  // Property state
const [clientProperties, setClientProperties] = useState([]);
const [loadingProperties, setLoadingProperties] = useState(false);
const [selectedPropertyId, setSelectedPropertyId] = useState('');
const [showNewPropertyForm, setShowNewPropertyForm] = useState(false);
const [newPropertyData, setNewPropertyData] = useState({
  address: '', unit_number: '', property_type: 'residential', gate_code: '', access_instructions: ''
});
const [newPropertySaving, setNewPropertySaving] = useState(false);
const [newPropertyError, setNewPropertyError] = useState(null);


  // Initialize form with default values or provided data
  const defaultValues = {
    client_id: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    work_type: 'service_call',
    property_id: null,
    service_location: { address: '' },
    equipment_make: '',
    equipment_model: '',
    equipment_serial: '',
    equipment_version: '',
    equipment_type: '',
    equipment_subtype: '',
    is_wall_mounted: false,
    equipment_notes: '',
    symptoms: [],
    service_items: [],
    is_recurring: false,
    invoice_subtotal: 0,
    invoice_tax: 0,
    invoice_total: 0,
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
      description: initialData.description || '',
      priority: initialData.priority || 'medium',
      status: initialData.status || 'pending',
      work_type: initialData.work_type || 'service_call',
      property_id: initialData.property_id || null,
      service_location: initialData.service_location || { address: '' },
      equipment_make: initialData.equipment_make || '',
      equipment_model: initialData.equipment_model || '',
      equipment_serial: initialData.equipment_serial || '',
      equipment_version: initialData.equipment_version || '',
      equipment_type: initialData.equipment_type || '',
      equipment_subtype: initialData.equipment_subtype || '',
      is_wall_mounted: initialData.is_wall_mounted || false,
      equipment_notes: initialData.equipment_notes || '',
      service_items: (initialData.service_items || []).map((si) => {
        const qty = Number(si.quantity ?? 1);
        const unit = Number(si.unit_price ?? si.price ?? 0);
        const total =
          si.total_price != null && si.total_price !== ''
            ? Number(si.total_price)
            : qty * unit;
        return {
          ...si,
          name: si.name || si.service_name || 'Service',
          quantity: qty,
          unit_price: unit,
          total_price: total,
        };
      }),
      is_recurring: initialData.is_recurring || false,
      invoice_subtotal: Number(initialData.invoice_subtotal ?? 0),
      invoice_tax: Number(initialData.invoice_tax ?? 0),
      invoice_total: Number(initialData.invoice_total ?? 0),
    };
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    // Only validate client_id if it's empty string, null, or undefined
    if (!values.client_id) {
      errors.client_id = 'Client is required';
    }
    
    // Only validate work_type and status if they're required fields
    // These may not be in the form if they're handled elsewhere
    if (values.hasOwnProperty('work_type') && !values.work_type) {
      errors.work_type = 'Work Type is required';
    }
    
    if (values.hasOwnProperty('status') && !values.status) {
      errors.status = 'Status is required';
    }
    
    if (!values.priority) {
      errors.priority = 'Priority is required';
    }
    
    if (!values.service_location?.address) {
      errors.service_location = { address: 'Service location is required' };
    }
    
    if (!values.description) {
      errors.description = 'Description is required';
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    // Make a copy of values to modify
    const formattedValues = {
      ...values,
      // Explicitly include property_id (fallback to selectedPropertyId state if not in form values)
      property_id: values.property_id || selectedPropertyId || null,
      service_location: values.service_location || { address: '' },
      service_items: values.service_items.map(item => ({
        service_id: item.service_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))
    };

    // Format equipment fields - ensure empty strings are sent as null
    if (formattedValues.equipment_make === '') formattedValues.equipment_make = null;
    if (formattedValues.equipment_model === '') formattedValues.equipment_model = null;
    if (formattedValues.equipment_serial === '') formattedValues.equipment_serial = null;
    if (formattedValues.equipment_version === '') formattedValues.equipment_version = null;
    if (formattedValues.equipment_type === '') formattedValues.equipment_type = null;
    if (formattedValues.equipment_subtype === '') formattedValues.equipment_subtype = null;
    if (formattedValues.equipment_notes === '') formattedValues.equipment_notes = null;
    
    try {
      if (isEdit && initialData?.id) {
        // Update the work order
        await updateWorkOrder({
          id: initialData.id,
          data: formattedValues
        });
        
        // Show success message
        setSuccess(true);
        
        // Delay for 2 seconds so the user sees the success message
        setTimeout(() => {
          // Redirect to work order details page (with underscore in path)
          router.push(`/work_orders/${initialData.id}`);
        }, 2000);
      } else {
        // Create a new work order
        try {
          let newWorkOrder;

          newWorkOrder = await createWorkOrder(formattedValues);
        

          // Show success message
          setSuccess(true);
          
          // First check if the response is a direct work order object with ID (from the fixed hook)
          if (newWorkOrder && newWorkOrder.id) {
            console.log('New work order created with ID:', newWorkOrder.id);
            
            // Delay for 2 seconds so the user sees the success message
            setTimeout(() => {
              // Navigate to the new work order (using underscore not hyphen)
              router.push(`/work_orders/${newWorkOrder.id}?tab=appointments`);
            }, 2000);
          }
          // Fallback: check if we have a paginated response
          else if (newWorkOrder && newWorkOrder.items && newWorkOrder.items.length > 0) {
            // Use the first work order in the items array
            const createdWorkOrder = newWorkOrder.items[0];
            console.log('Created work order from items array:', createdWorkOrder);
            
            if (createdWorkOrder.id) {
              console.log('New work order created with ID (from items):', createdWorkOrder.id);
              
              // Delay for 2 seconds so the user sees the success message
              setTimeout(() => {
                // Navigate to the new work order (using underscore not hyphen)
                router.push(`/work_orders/${createdWorkOrder.id}`);
              }, 2000);
            } else {
              console.error('Error: Work order created but no ID found in the first item', createdWorkOrder);
              setSuccess(false);
              setError('Failed to retrieve the new work order ID. Please check the work orders list.');
            }
          } else {
            console.error('Error: New work order created but unexpected response format', newWorkOrder);
            setSuccess(false);
            setError('Work order was created but an error occurred. Please check the work orders list.');
          }
        } catch (error) {
          console.error('Error creating work order:', error);
          setSuccess(false);
          
          // Extract validation error details if available
          let errorMessage = 'Failed to create work order';
          
          if (error.message) {
            // Check for specific database constraint error
            if (error.message.includes('null value in column "previous_status"') || 
                error.message.includes('violates not-null constraint')) {
              errorMessage = 'There is a database constraint issue. Please contact your system administrator to fix the work_order_status_history table configuration.';
              console.error('Database constraint error in work_order_status_history table: previous_status cannot be null');
              
              // Log more detailed information for debugging
              console.error('Technical details: The work_order_status_history table has a not-null constraint on the previous_status column, but the API is trying to set it to null for new work orders.');
              
              // Use the workaround function to handle this specific error
              setTimeout(() => handleDatabaseConstraintError(), 2000);
            }
            // Check for other validation errors
            else if (error.message.includes('validation error')) {
              // Extract specific validation error from the message
              errorMessage = 'Validation error: ';
              
              if (error.message.includes('client_id')) {
                errorMessage += 'Client is required. ';
              }
              if (error.message.includes('priority')) {
                errorMessage += 'Priority is invalid. ';
              }
              if (error.message.includes('status')) {
                errorMessage += 'Status is invalid. ';
              }
              if (error.message.includes('equipment_make')) {
                errorMessage += 'Equipment make is invalid. ';
              }
              if (error.message.includes('equipment_model')) {
                errorMessage += 'Equipment model is invalid. ';
              }
              if (error.message.includes('equipment_serial')) {
                errorMessage += 'Equipment serial number is invalid. ';
              }
              if (error.message.includes('equipment_version')) {
                errorMessage += 'Equipment version is invalid. ';
              }
              if (error.message.includes('actual_start')) {
                errorMessage += 'Actual start date is invalid. ';
              }
              if (error.message.includes('actual_end')) {
                errorMessage += 'Actual end date is invalid. ';
              }
              if (error.message.includes('assigned_technician_id')) {
                errorMessage += 'Assigned technician is invalid. ';
              }
              
              // If no specific fields were identified, use the original message
              if (errorMessage === 'Validation error: ') {
                errorMessage += error.message;
              }
            } else {
              errorMessage += ': ' + error.message;
            }
          }
          
          setError(errorMessage);
          // Don't throw the error again
        }
      }
    } catch (error) {
      console.error('Error saving work order:', error);
      setSuccess(false);
      
      // Extract validation error details if available
      let errorMessage = 'Error saving work order';
      
      if (error.message) {
        // Check for specific database constraint error
        if (error.message.includes('null value in column "previous_status"') || 
            error.message.includes('violates not-null constraint')) {
          errorMessage = 'There is a database constraint issue. Please contact your system administrator to fix the work_order_status_history table configuration.';
          console.error('Database constraint error in work_order_status_history table: previous_status cannot be null');
          
          // Log more detailed information for debugging
          console.error('Technical details: The work_order_status_history table has a not-null constraint on the previous_status column, but the API is trying to set it to null.');
          
          // Use the workaround function to handle this specific error
          setTimeout(() => handleDatabaseConstraintError(), 2000);
        }
        // Check for other validation errors
        else if (error.message.includes('validation error')) {
          // Extract specific validation error from the message
          errorMessage = 'Validation error: ';
          
          if (error.message.includes('scheduled_end')) {
            errorMessage += 'End date is invalid. ';
          }
          if (error.message.includes('scheduled_start')) {
            errorMessage += 'Start date is invalid. ';
          }
          if (error.message.includes('client_id')) {
            errorMessage += 'Client is required. ';
          }
          if (error.message.includes('priority')) {
            errorMessage += 'Priority is invalid. ';
          }
          if (error.message.includes('status')) {
            errorMessage += 'Status is invalid. ';
          }
          if (error.message.includes('actual_start')) {
            errorMessage += 'Actual start date is invalid. ';
          }
          if (error.message.includes('actual_end')) {
            errorMessage += 'Actual end date is invalid. ';
          }
          if (error.message.includes('assigned_technician_id')) {
            errorMessage += 'Assigned technician is invalid. ';
          }
          
          // If no specific fields were identified, use the original message
          if (errorMessage === 'Validation error: ') {
            errorMessage += error.message;
          }
        } else {
          errorMessage += ': ' + error.message;
        }
      }
      
      setError(errorMessage);
      // Don't throw the error again
    }
  };
  
  // Get form utilities
  const { 
    values, 
    errors, 
    touched, 
    isSubmitting, 
    handleChange, 
    handleBlur, 
    handleSubmit: submitForm, 
    resetForm, 
    setFormValues,
    setErrors
  } = useForm(getInitialValues(), handleSubmit, validate);

  // Add a custom setFieldValue function since it's missing from useForm
  const setFieldValue = useCallback((field, value) => {
    const newValues = { ...values };
    
    // Handle nested fields using dot notation
    if (field.includes('.')) {
      const parts = field.split('.');
      let current = newValues;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
    } else {
      newValues[field] = value;
    }
    
    setFormValues(newValues);
  }, [values, setFormValues]);
  
  // Add this near the top of the component, with other state variables
  const clientIdProcessedRef = useRef(false);
  
  // Add function to handle database constraint error by redirecting to work orders list
  const handleDatabaseConstraintError = () => {
    console.log('Applying workaround for database constraint error...');
    setError('Redirecting to work orders list as a workaround...');
    
    // After a short delay, redirect to the work orders list
    setTimeout(() => {
      router.push('/work_orders');
    }, 1500);
  };
  
  // Handle client selection change
  const handleClientChange = async (e) => {
    const clientId = e.target.value;
    console.log('[DEBUG] Client selection changed to:', clientId);
    
    // Create a copy of the current values to update
    const updatedValues = {
      ...values,
      client_id: clientId
    };
    
    // Directly update form values instead of using handleChange
    setFormValues(updatedValues);
    
    // Clear error for this field if it exists
    if (errors.client_id) {
      setErrors({
        ...errors,
        client_id: undefined
      });
    }
    
    // Handle blur manually since we're bypassing handleChange
    // This marks the field as touched for validation
    handleBlur({ target: { name: 'client_id' }});
    
    if (clientId) {
      try {
        console.log('[DEBUG] Fetching client details for ID:', clientId);
        const client = await apiClient(`clients/${clientId}`);
        console.log('[DEBUG] Received client data:', client);
        setClientData(client);
        
        // Auto-populate service location with client's address
        if (client && client.address) {
          const addressStr = [
            client.address.street1,
            client.address.street2,
            client.address.city,
            client.address.state,
            client.address.zip,
            client.address.country
          ].filter(Boolean).join(', ');
          
          console.log('[DEBUG] Setting service location to:', addressStr);
          
          // Update values with both client ID and service location
          setFormValues({
            ...updatedValues,
            service_location: {
              ...updatedValues.service_location,
              address: addressStr
            }
          });
        }
      } catch (error) {
        console.error('Error fetching client details:', error);
        // Keep the client ID even if we couldn't fetch details
        console.log('[DEBUG] Keeping client ID after fetch error:', clientId);
      }
    } else {
      // Clear client data when selecting the empty option
      console.log('[DEBUG] Clearing client data - empty selection');
      setClientData({});
      setFormValues({
        ...updatedValues,
        service_location: { address: '' }
      });
    }
  };


  
  // Component initialization - load reference data
  useEffect(() => {
    // Load clients, services, and populate form if editing
    const loadReferenceData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch clients - needed for client selector
        console.log('[DEBUG] Fetching clients from API...');
        const clientsResponse = await apiClient('clients');
        console.log('[DEBUG] Clients API response:', clientsResponse);
        
        if (clientsResponse && clientsResponse.items && Array.isArray(clientsResponse.items)) {
          // Handle paginated response format for clients
          const clientOptions = clientsResponse.items.map(client => ({
          value: client.id,
            label: `${client.first_name} ${client.last_name} (${client.email || 'No Email'})`
          }));
          setClients(clientOptions);
        } else if (clientsResponse && Array.isArray(clientsResponse)) {
          // Handle non-paginated response format for clients
          const clientOptions = clientsResponse.map(client => ({
            value: client.id,
            label: `${client.first_name} ${client.last_name} (${client.email || 'No Email'})`
          }));
          setClients(clientOptions);
        } else {
          console.warn('[DEBUG] Clients response is empty or not in expected format:', clientsResponse);
          setClients([]);
        }
        
        // Fetch services - these are the SKUs
        try {
          const allSkusResponse = await apiClient('services'); // Assuming this endpoint returns all SKUs
          console.log('[DEBUG] All SKUs API response:', allSkusResponse);
          
          let rawSkus = [];
          if (allSkusResponse && allSkusResponse.items && Array.isArray(allSkusResponse.items)) {
            rawSkus = allSkusResponse.items;
          } else if (allSkusResponse && Array.isArray(allSkusResponse)) {
            rawSkus = allSkusResponse;
          } else {
            console.warn('[DEBUG] SKUs response is empty or not in expected format:', allSkusResponse);
          }
          // Store the raw SKU data. Ensure it includes id, name, base_price, equipment_type, service_type (or category)
          // Example: item might have { id, name, base_price, equipment_type: { value: 'tv' }, service_type: { value: 'diagnostic' } }
          // Or equipment_type: 'tv', service_type: 'diagnostic' directly
          // The mapping below assumes equipment_type and service_type are strings or have a .value property
          setAllServicesRaw(rawSkus.map(sku => ({
            ...sku,
            id: sku.id, // ensure id is present
            name: sku.name,
            base_price: sku.base_price || 0,
            // Adjust access to equipment_type and service_type based on actual API response structure
            // Convert to lowercase to match mapping keys
            equipment_type: (typeof sku.equipment_type === 'string' ? sku.equipment_type : sku.equipment_type?.value)?.toLowerCase(),
            service_type: (typeof sku.service_type === 'string' ? sku.service_type : sku.service_type?.value)?.toLowerCase(),
          })));
          console.log('[DEBUG] Processed raw SKUs count:', rawSkus.length);

        } catch (servicesError) { // Renamed error variable to avoid conflict
          console.error('[DEBUG] Error fetching SKUs:', servicesError);
          setAllServicesRaw([]); // Set to empty array on error
        }
        
        // If in edit mode and we have an initial client ID, load the client details
        if (isEdit && initialData?.client_id) {
          try {
            const client = await apiClient(`clients/${initialData.client_id}`);
            setClientData(client);
          } catch (error) {
            console.error('Error loading client details:', error);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading reference data:', error);
        setError('Failed to load required data. Please try refreshing the page.');
        setIsLoading(false);
      }
    };
    
    loadReferenceData();
  }, [isEdit, initialData?.client_id]);
  
  // Handle SKU Equipment Category Change
  const handleSkuEquipmentCategoryChange = (e) => {
    const categoryKey = e.target.value;
    setSelectedSkuEquipmentCategory(categoryKey);
    setFieldValue('selected_sku_id', ''); // Clear selected SKU when category changes

    if (categoryKey === '') {
      setFilteredSkusForDropdown([]);
      return;
    }

    const targetEquipmentTypes = EQUIPMENT_CATEGORY_MAP[categoryKey] || [];
    const filtered = allServicesRaw.filter(sku => 
      targetEquipmentTypes.includes(sku.equipment_type)
    );

    // Group by service_type (e.g., diagnostic, repair)
    const groupedSkus = filtered.reduce((acc, sku) => {
      const groupKey = sku.service_type || 'other'; // Fallback for SKUs without a service_type
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push({ 
        value: sku.id, 
        label: `${sku.name}${sku.sku_code ? ` (${sku.sku_code})` : ''} - 
        ${sku.duration_minutes || 0} min - $${(sku.base_price || 0).toFixed(2)}`,
        // Store entire sku object for easy addition to service_items
        skuData: sku 
      });
      return acc;
    }, {});

    // Sort groups and SKUs within groups
    const sortedAndFormattedSkus = Object.entries(groupedSkus)
      .sort(([groupAKey], [groupBKey]) => {
        return (SERVICE_TYPE_ORDER_MAP[groupAKey] || 99) - (SERVICE_TYPE_ORDER_MAP[groupBKey] || 99);
      })
      .flatMap(([groupKey, skusInGroup]) => {
        const groupLabel = SERVICE_TYPE_GROUP_LABELS[groupKey] || groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
        // Add a non-selectable group header option
        // Note: SelectInput might need specific props for optgroup like functionality
        // This is a common pattern: an option with a special value and disabled.
        return [
          { value: `header-${groupKey}`, label: groupLabel, disabled: true, isHeader: true }, 
          ...skusInGroup.sort((a, b) => a.label.localeCompare(b.label))
        ];
      });
    
    setFilteredSkusForDropdown(sortedAndFormattedSkus);
  };

  // Handle SKU Selection Change (for the second dropdown)
  const handleSkuSelectionChange = (e) => {
    const selectedSkuId = e.target.value;
    if (!selectedSkuId || selectedSkuId.startsWith('header-')) {
      // setFieldValue('selected_sku_id', ''); // This field might not be needed if directly adding to items
      return;
    }
    
    const selectedSkuOpt = filteredSkusForDropdown.find(opt => opt.value === selectedSkuId);
    if (selectedSkuOpt && selectedSkuOpt.skuData) {
      const skuData = selectedSkuOpt.skuData;
      // Add to service_items
      // Check if service already exists, if so, maybe increment quantity (for future enhancement)
      const existingItemIndex = values.service_items.findIndex(item => item.service_id === skuData.id);

      if (existingItemIndex > -1) {
        // Optionally, alert user or increment quantity. For now, let's just prevent duplicates.
        alert("This service is already added. You can adjust quantity later.");
        return;
      }
      
      const newServiceItem = {
        service_id: skuData.id,
        name: skuData.name,
        quantity: 1, // Default quantity
        unit_price: skuData.base_price || 0,
        total_price: (skuData.base_price || 0) * 1, // quantity * unit_price
        // any other relevant sku data to store with the item
      };
      
      setFieldValue('service_items', [...values.service_items, newServiceItem]);
      // Optionally, clear the SKU dropdowns after adding
      // setSelectedSkuEquipmentCategory('');
      // setFilteredSkusForDropdown([]);
      // setFieldValue('selected_sku_id', ''); // Clear the dropdown value
    }
  };

  // Remove a service item from the list
  const removeServiceItem = (serviceIdToRemove) => {
    setFieldValue('service_items', values.service_items.filter(item => item.service_id !== serviceIdToRemove));
  };

  // Calculate totals whenever service_items change
  useEffect(() => {
    let subtotal = 0;
    values.service_items.forEach(item => {
      subtotal += (item.unit_price || 0) * (item.quantity || 0);
    });
    // Basic tax calculation (e.g. 0% for now, can be configurable)
    const taxRate = 0.00; 
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    setFieldValue('invoice_subtotal', subtotal);
    setFieldValue('invoice_tax', tax);
    setFieldValue('invoice_total', total);
  }, [values.service_items]);
  
  // Save new client and auto-select
  const handleSaveNewClient = async () => {
    if (!newClientData.first_name || !newClientData.last_name) {
      setNewClientError('First and last name are required.');
      return;
    }
    setNewClientSaving(true);
    setNewClientError(null);
    try {
      const created = await apiClient('clients', {
        method: 'POST',
        body: JSON.stringify(newClientData)
      });
      // Add to clients list and auto-select
      const newOption = {
        value: created.id,
        label: `${created.first_name} ${created.last_name} (${created.email || 'No Email'})`
      };
      setClients(prev => [...prev, newOption]);
      setFormValues({ ...values, client_id: created.id });
      setClientData(created);
      // Auto-populate address if available
      if (created.address) {
        const addressStr = [created.address.street1, created.address.street2, created.address.city, created.address.state, created.address.zip].filter(Boolean).join(', ');
        setFormValues(prev => ({ ...prev, client_id: created.id, service_location: { address: addressStr } }));
      }
      setShowNewClientForm(false);
      setNewClientData({ first_name: '', last_name: '', email: '', phone: '' });
    } catch (err) {
      setNewClientError(err.message || 'Failed to create client.');
    } finally {
      setNewClientSaving(false);
    }
  };
  
// Fetch properties when client changes
useEffect(() => {
  if (!values.client_id) {
    setClientProperties([]);
    setSelectedPropertyId('');
    return;
  }
  setLoadingProperties(true);
  apiClient(`properties/client/${values.client_id}`)
    .then(data => setClientProperties(Array.isArray(data) ? data : []))
    .catch(() => setClientProperties([]))
    .finally(() => setLoadingProperties(false));
}, [values.client_id]);

// Initialize selectedPropertyId from initialData when editing
useEffect(() => {
  if (initialData?.property_id) {
    setSelectedPropertyId(initialData.property_id);
  }
}, [initialData?.property_id]);

const handlePropertySelect = (propertyId) => {
  setSelectedPropertyId(propertyId);
  // Set the property_id in the form values
  setFieldValue('property_id', propertyId || null);
  const property = clientProperties.find(p => p.id === propertyId);
  if (property) {
    const addr = [property.address, property.unit_number ? `Unit ${property.unit_number}` : ''].filter(Boolean).join(', ');
    setFieldValue('service_location', { address: addr });
  }
};

const handleCreateProperty = async () => {
  if (!newPropertyData.address.trim()) { setNewPropertyError('Address is required'); return; }
  setNewPropertySaving(true);
  setNewPropertyError(null);
  try {
    const created = await apiClient('properties', {
      method: 'POST',
      body: JSON.stringify({ client_id: values.client_id, ...newPropertyData })
    });
    setClientProperties(prev => [...prev, created]);
    handlePropertySelect(created.id);
    setShowNewPropertyForm(false);
    setNewPropertyData({ address: '', unit_number: '', property_type: 'residential', gate_code: '', access_instructions: '' });
  } catch (err) {
    setNewPropertyError(err.message || 'Failed to create property');
  } finally {
    setNewPropertySaving(false);
  }
};

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
    <form onSubmit={submitForm} className="space-y-6 text-gray-900 dark:text-gray-100">
      {/* Success message */}
      {success && (
        <div className="rounded-md bg-green-50 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-grow">
              <h3 className="text-sm font-medium text-green-800">Work order {isEdit ? "updated" : "created"} successfully!</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Your changes have been saved. Redirecting to details page...</p>
              </div>
            </div>
            <div className="flex-shrink-0 self-center">
              <button
                type="button"
                className="bg-green-50 rounded-md inline-flex text-green-400 hover:text-green-500 focus:outline-none"
                onClick={() => setSuccess(false)}
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Client and basic info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client <span className="text-red-500">*</span>
          </label>
          <Select
            options={[
              { value: '__new__', label: '+ Add New Client', isSpecial: true },
              ...clients
            ]}
            value={clients.find(c => c.value === values.client_id) || null}
            onChange={(selected) => {
              if (selected?.value === '__new__') {
                setShowNewClientForm(true);
              } else {
                setShowNewClientForm(false);
                handleClientChange({ target: { value: selected?.value || '' } });
              }
            }}
            placeholder="Search or select client..."
            isClearable
            styles={{
              control: (base, state) => ({
                ...base,
                backgroundColor: 'var(--color-bg-input, #1f2937)',
                borderColor: state.isFocused ? '#3b82f6' : '#4b5563',
                boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
                borderRadius: '0.375rem',
                minHeight: '38px',
              }),
              menu: (base) => ({ ...base, backgroundColor: '#1f2937', zIndex: 50 }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#374151' : 'transparent',
                color: state.data?.isSpecial ? '#34d399' : state.isSelected ? 'white' : '#d1d5db',
                fontWeight: state.data?.isSpecial ? '600' : 'normal',
              }),
              singleValue: (base) => ({ ...base, color: '#e5e7eb' }),
              input: (base) => ({ ...base, color: '#e5e7eb' }),
              placeholder: (base) => ({ ...base, color: '#9ca3af' }),
              indicatorSeparator: () => ({ display: 'none' }),
            }}
          />
          {touched.client_id && !values.client_id && (
            <p className="mt-1 text-sm text-red-600">Client is required</p>
          )}

          {/* Inline new client form */}
          {showNewClientForm && (
            <div className="mt-3 p-4 border border-green-300 dark:border-green-700 rounded-md bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center">
                  <FaUserPlus className="mr-2" /> New Client
                </h4>
                <button type="button" onClick={() => setShowNewClientForm(false)} className="text-gray-400 hover:text-gray-600">
                  <FaTimes />
                </button>
              </div>
              {newClientError && <p className="text-sm text-red-600 mb-2">{newClientError}</p>}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={newClientData.first_name}
                  onChange={e => setNewClientData(p => ({ ...p, first_name: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Last Name *"
                  value={newClientData.last_name}
                  onChange={e => setNewClientData(p => ({ ...p, last_name: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newClientData.email}
                  onChange={e => setNewClientData(p => ({ ...p, email: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={newClientData.phone}
                  onChange={e => setNewClientData(p => ({ ...p, phone: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveNewClient}
                disabled={newClientSaving}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                {newClientSaving ? 'Saving...' : 'Save & Select Client'}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Equipment Information */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">Equipment Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput
            label="Equipment Type"
            id="equipment_type"
            name="equipment_type"
            value={values.equipment_type}
            onChange={(e) => {
              handleChange(e);
              const newType = e.target.value;
              if (newType !== 'tv') {
                handleChange({ target: { name: 'is_wall_mounted', value: false, type: 'checkbox', checked: false } });
              }
              handleChange({ target: { name: 'equipment_subtype', value: '', type: 'select-one' } });
            }}
            onBlur={handleBlur}
            error={touched.equipment_type && errors.equipment_type}
            options={EQUIPMENT_TYPES}
            required={!values.equipment_type}
          />
          
          {values.equipment_type && (
            <SelectInput
              label={values.equipment_type === 'appliance' ? "Appliance Type" : "TV Size"}
              id="equipment_subtype"
              name="equipment_subtype"
              value={values.equipment_subtype}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.equipment_subtype && errors.equipment_subtype}
              options={EQUIPMENT_SUBTYPES[values.equipment_type] || []}
              required={!values.equipment_subtype}
            />
          )}
          
          {/* Symptom Tags */}
          {(values.equipment_subtype || values.equipment_type === 'tv') && (() => {
            const symptomKey = values.equipment_type === 'tv' ? 'tv' : SUBTYPE_TO_SYMPTOM_KEY[values.equipment_subtype];
            const symptoms = symptomKey ? SYMPTOMS_BY_TYPE[symptomKey] : null;
            if (!symptoms) return null;
            return (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reported Symptoms</label>
                <div className="flex flex-wrap gap-2">
                  {symptoms.map(symptom => {
                    const selected = (values.symptoms || []).includes(symptom);
                    return (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => {
                          const current = values.symptoms || [];
                          const updated = selected
                            ? current.filter(s => s !== symptom)
                            : [...current, symptom];
                          setFieldValue('symptoms', updated);
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      >
                        {symptom}
                      </button>
                    );
                  })}
                </div>
                {(values.symptoms || []).length > 0 && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    {values.symptoms.length} symptom{values.symptoms.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            );
          })()}

          <SelectInput
            label="Manufacturer"
            id="equipment_make"
            name="equipment_make"
            value={values.equipment_make}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.equipment_make && errors.equipment_make}
            options={MANUFACTURERS}
            required={!values.equipment_make}
          />
          
        <TextInput
            label="Model Number"
            id="equipment_model"
            name="equipment_model"
            value={values.equipment_model}
            onChange={(e) => setFieldValue('equipment_model', e.target.value.toUpperCase())}
            onBlur={handleBlur}
            error={touched.equipment_model && errors.equipment_model}
            placeholder="Model number/name"
            required={!values.equipment_model}
        />
        
        <TextInput
            label="Serial Number"
            id="equipment_serial"
            name="equipment_serial"
            value={values.equipment_serial}
            onChange={(e) => setFieldValue('equipment_serial', e.target.value.toUpperCase())}
            onBlur={handleBlur}
            error={touched.equipment_serial && errors.equipment_serial}
            placeholder="Serial number"
          />
          
          <TextInput
            label="Version/Revision"
            id="equipment_version"
            name="equipment_version"
            value={values.equipment_version}
            onChange={(e) => setFieldValue('equipment_version', e.target.value.toUpperCase())}
            onBlur={handleBlur}
            error={touched.equipment_version && errors.equipment_version}
            placeholder="Version or revision"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Equipment Notes
            </label>
            <textarea
              id="equipment_notes"
              name="equipment_notes"
              value={values.equipment_notes}
              onChange={handleChange}
              onBlur={handleBlur}
              rows={2}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none overflow-y-auto"
              placeholder="Equipment notes..."
              style={{ minHeight: '2.5rem', maxHeight: '8rem', overflowY: 'auto' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
          </div>
        </div>{/* end grid */}

        {values.equipment_type === 'tv' && (
          <div className="mt-2">
            <Checkbox
              label="TV is Wall Mounted"
              name="is_wall_mounted"
              checked={values.is_wall_mounted}
              onChange={handleChange}
            />
          </div>
        )}
        
        {/* <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900 rounded text-sm">
          <p className="text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> If any equipment information is unavailable, leave the field blank and it will display as "N/A" in reports.
          </p>
        </div> */}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectInput
          label="Priority"
          name="priority"
          value={values.priority}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.priority && errors.priority}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' }
          ]}
        />
        
        {/* Empty div to maintain grid layout */}
        <div></div>
      </div>
      
      {/* Location */}
      {/* Property Selector */}
      {values.client_id && (
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property</label>
          {loadingProperties ? (
            <p className="text-sm text-gray-500">Loading properties...</p>
          ) : !showNewPropertyForm ? (
            <div className="space-y-2">
              <select
                value={selectedPropertyId}
                onChange={(e) => handlePropertySelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white text-sm"
              >
                <option value="">Select a property or enter address below...</option>
                {clientProperties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.address}{p.unit_number ? ` – Unit ${p.unit_number}` : ''}{p.gate_code ? ` 🔑 ${p.gate_code}` : ''}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewPropertyForm(true)} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <FaUserPlus className="w-3 h-3" /> Add new property for this client
              </button>
            </div>
          ) : (
            <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">New Property</span>
                <button type="button" onClick={() => { setShowNewPropertyForm(false); setNewPropertyError(null); }} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
              </div>
              {newPropertyError && <p className="text-sm text-red-600 dark:text-red-400">{newPropertyError}</p>}
              <input type="text" placeholder="Address *" value={newPropertyData.address} onChange={e => setNewPropertyData(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
              <input type="text" placeholder="Unit number (optional)" value={newPropertyData.unit_number} onChange={e => setNewPropertyData(p => ({ ...p, unit_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
              <select value={newPropertyData.property_type} onChange={e => setNewPropertyData(p => ({ ...p, property_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm">
                <option value="residential">Residential</option>
                <option value="rental">Rental Property</option>
                <option value="commercial">Commercial</option>
                <option value="flip">Flip/Investment</option>
              </select>
              <input type="text" placeholder="Gate code (optional)" value={newPropertyData.gate_code} onChange={e => setNewPropertyData(p => ({ ...p, gate_code: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm" />
              <textarea placeholder="Access instructions (optional)" value={newPropertyData.access_instructions} onChange={e => setNewPropertyData(p => ({ ...p, access_instructions: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm resize-none" />
              <div className="flex gap-2">
                <button type="button" onClick={handleCreateProperty} disabled={newPropertySaving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {newPropertySaving ? 'Creating...' : 'Create Property'}
                </button>
                <button type="button" onClick={() => { setShowNewPropertyForm(false); setNewPropertyError(null); }} className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Location */}
      <div className="relative">
        <TextInput
          label="Service Location"
          name="service_location.address"
          value={values.service_location?.address || ''}
          onChange={(e) => {
            setFieldValue('service_location', { ...values.service_location, address: e.target.value });
          }}
          onBlur={handleBlur}
          error={touched['service_location.address'] && errors['service_location.address']}
          placeholder="Full address where service will be performed"
        />
        {values.client_id && clientData && clientData.address && (
          <button
            type="button"
            className="absolute right-2 top-8 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={() => {
              const addressStr = [clientData.address.street1, clientData.address.street2, clientData.address.city, clientData.address.state, clientData.address.zip, clientData.address.country].filter(Boolean).join(', ');
              setFieldValue('service_location', { ...values.service_location, address: addressStr });
            }}
          >
            Use Client Address
          </button>
        )}
      </div>
      
      {/* Description */}
      <TextareaInput
        label="Description"
        name="description"
        value={values.description}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.description && errors.description}
        rows={4}
        placeholder="Detailed description of the problem and requirements"
        required
      />
      
      {/* Form-level error */}
      {(errors._form || error) && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-grow">
              <h3 className="text-sm font-medium text-red-800">There was a problem with your submission</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{errors._form || error}</p>
              </div>
              {error && error.includes('validation error') && (
                <div className="mt-3">
                  <p className="text-xs text-red-600">Please check the form fields above and try again.</p>
                </div>
              )}
              {error && error.includes('database constraint issue') && (
                <div className="mt-2 flex space-x-2">
                  <button
                    type="button"
                    className="rounded-md px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                    onClick={() => router.push('/work_orders')}
                  >
                    View Work Orders
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-3 py-2 text-sm font-medium border border-red-300 text-red-700 bg-white hover:bg-red-50"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 self-center">
              <button
                type="button"
                className="bg-red-50 rounded-md inline-flex text-red-400 hover:text-red-500 focus:outline-none"
                onClick={() => setError(null)}
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
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
          isLoading={isSubmitting || isMutating}
          disabled={isSubmitting || isMutating}
          icon={<FaSave />}
        >
          {isEdit ? 'Update' : 'Create'} Work Order
        </Button>
      </div>
    </form>
  );
}