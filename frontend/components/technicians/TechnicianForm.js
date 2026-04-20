import { useState, useEffect } from 'react';
import { useForm } from '../../hooks/useForm';
import { TextInput, SelectInput, TextareaInput, Checkbox, Button } from '../ui/FormElements';
import { FaSave, FaTimes, FaPlus, FaMinus } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { useSkills, useTechnicianMutations } from '../../hooks/useTechnicians';
import { apiClient } from '../../utils/api-client';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useTheme } from '../../context/ThemeContext';

export default function TechnicianForm({ technician, onSubmit, isSubmitting }) {
  const router = useRouter();
  const [availabilityExpanded, setAvailabilityExpanded] = useState(false);
  const [userCreateMethod, setUserCreateMethod] = useState('existing');
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userError, setUserError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const { theme } = useTheme();
  
  // Determine if we're in edit mode
  const isEdit = !!technician?.id;
  
  // Get technician mutations from props instead
  const { create, update } = useTechnicianMutations();
  
  // Get skills list
  const { data: skillsList, isLoading: isLoadingSkills } = useSkills();
  
  // Selected skills state
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  
  // Only set the skills once when component mounts or when technician changes
  useEffect(() => {
    if (technician?.skills) {
      const skills = Array.isArray(technician.skills) 
        ? technician.skills 
        : (technician.skills ? [technician.skills] : []);
      setSelectedSkills(skills);
    }
  }, [technician]);

  // Ensure dark mode applies correctly
  useEffect(() => {
    // Apply the theme from context to the document
    if (theme?.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme?.mode]);
  
  // Initialize form with default values or provided data
  const defaultValues = {
    user_id: '',
    user_email: '',
    user_first_name: '',
    user_last_name: '',
    employee_id: '',
    hourly_rate: '',
    max_daily_jobs: '8',
    service_radius: '50',
    notes: '',
    status: 'active',
    skills: [],
    certifications: {},
    default_availability: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: null,
      sunday: null
    },
    exceptions: []
  };
  
  // Prepare initial form values
  const getInitialValues = () => {
    if (!technician) return defaultValues;
    
    // Don't set state here - it causes infinite loop
    // Use the technician skills directly instead of setting state
    const skills = Array.isArray(technician.skills) 
      ? technician.skills 
      : (technician.skills ? [technician.skills] : []);
    
    // Ensure certifications is an object
    let certifications = technician.certifications;
    if (!certifications || Array.isArray(certifications) || typeof certifications !== 'object') {
      certifications = {};
    }
    
    return {
      user_id: technician.user?.id || '',
      user_email: technician.user?.email || '',
      user_first_name: technician.user?.first_name || '',
      user_last_name: technician.user?.last_name || '',
      employee_id: technician.employee_id || '',
      hourly_rate: technician.hourly_rate?.toString() || '',
      max_daily_jobs: technician.max_daily_jobs?.toString() || '8',
      service_radius: technician.service_radius?.toString() || '50',
      notes: technician.notes || '',
      status: technician.status || 'active',
      skills: skills,
      certifications: certifications,
      default_availability: technician.availability || defaultValues.default_availability,
      exceptions: technician.exceptions || []
    };
  };
  
  // Form validation
  const validate = (values) => {
    const errors = {};
    
    if (userCreateMethod === 'existing' && !values.user_id) {
      errors.user_id = 'User is required';
    }
    
    if (userCreateMethod === 'new') {
      if (!values.user_email) {
        errors.user_email = 'Email is required';
      } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.user_email)) {
        errors.user_email = 'Invalid email address';
      }
      
      if (!values.user_first_name) {
        errors.user_first_name = 'First name is required';
      }
      
      if (!values.user_last_name) {
        errors.user_last_name = 'Last name is required';
      }
    }
    
    if (values.hourly_rate && isNaN(parseFloat(values.hourly_rate))) {
      errors.hourly_rate = 'Hourly rate must be a number';
    }
    
    if (values.max_daily_jobs && isNaN(parseInt(values.max_daily_jobs))) {
      errors.max_daily_jobs = 'Max daily jobs must be a number';
    }
    
    if (values.service_radius && isNaN(parseFloat(values.service_radius))) {
      errors.service_radius = 'Service radius must be a number';
    }
    
    // Validate certifications
    if (values.certifications) {
      try {
        const parsed = typeof values.certifications === 'string' 
          ? JSON.parse(values.certifications) 
          : values.certifications;
        
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          errors.certifications = 'Certifications must be a valid JSON object';
        }
      } catch (err) {
        errors.certifications = 'Invalid JSON format for certifications';
      }
    }
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    try {
      setError(null);
      setSuccess(false);
      
      // Prepare technician data
      const technicianData = {
        employee_id: values.employee_id || "",
        hourly_rate: values.hourly_rate ? parseFloat(values.hourly_rate) : 0,
        skills: selectedSkills || [],
        certifications: values.certifications || {},
        status: values.status || "active",
        service_radius: values.service_radius ? parseInt(values.service_radius, 10) : 50,
        notes: values.notes || "",
        availability: values.default_availability || defaultValues.default_availability,
        exceptions: values.exceptions || []
      };
      
      // Only add user information if creating a new technician
      if (!isEdit) {
        if (userCreateMethod === 'new') {
          if (!values.user_email) {
            throw new Error('Email is required when creating a new user');
          }
          // Ensure user information is properly formatted
          technicianData.user_email = values.user_email.trim();
          technicianData.user_first_name = values.user_first_name.trim();
          technicianData.user_last_name = values.user_last_name.trim();
        } else if (userCreateMethod === 'existing') {
          if (!values.user_id) {
            throw new Error('User ID is required when using an existing user');
          }
          technicianData.user_id = values.user_id;
        }
      }
      
      // Log the data being sent
      console.log('Submitting technician data:', JSON.stringify(technicianData, null, 2));
      
      // Use the onSubmit prop instead of directly calling mutations
      await onSubmit(technicianData);
      
      // Show success message
      setSuccess(true);
    } catch (err) {
      console.error('Error saving technician:', err);
      console.error('Full error details:', err.responseData || err);
      setSuccess(false);
      
      // Extract validation error details if available
      let errorMessage = 'Failed to save technician data';
      
      if (err.responseData && err.status === 422) {
        // Handle validation errors from API
        if (err.responseData.detail) {
          if (Array.isArray(err.responseData.detail)) {
            // Format the validation errors
            errorMessage = 'Validation errors: ' + err.responseData.detail.map(detail => {
              const field = detail.loc?.slice(1).join('.') || 'unknown field';
              return `${field}: ${detail.msg}`;
            }).join('; ');
          } else if (typeof err.responseData.detail === 'string') {
            errorMessage = `Validation error: ${err.responseData.detail}`;
          }
        }
      } else if (err.message) {
        if (err.message.includes('validation error')) {
          // Extract specific validation error from the message
          errorMessage = 'Validation error: ' + err.message;
        } else {
          errorMessage += ': ' + err.message;
        }
      }
      
      setError(errorMessage);
    }
  };

  // Initialize form directly like in WorkOrderForm
  const form = useForm(getInitialValues(), handleSubmit, validate);
  
  // Only update form values when technician changes
  useEffect(() => {
    if (technician) {
      form.setFormValues(getInitialValues());
    }
  }, [technician]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Load users for dropdown
  useEffect(() => {
    const loadUsers = async () => {
      if (userCreateMethod !== 'existing') return;
      
      setIsLoadingUsers(true);
      setUserError(null);
      
      try {
        const data = await apiClient('admin/users?limit=100');
        
        setUsers(data?.items?.map(user => ({
          value: user.id,
          label: `${user.first_name} ${user.last_name} (${user.email})`
        })) || []);
      } catch (error) {
        console.error('Error loading users:', error);
        setUserError('Failed to load users');
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    loadUsers();
  }, [userCreateMethod]);
  
  // Handle adding a new skill
  const handleAddSkill = () => {
    if (newSkill && !selectedSkills.includes(newSkill)) {
      const updatedSkills = [...selectedSkills, newSkill];
      setSelectedSkills(updatedSkills);
      form.setFormValues({ skills: updatedSkills });
      setNewSkill('');
    }
  };
  
  // Handle removing a skill
  const handleRemoveSkill = (skill) => {
    const updatedSkills = selectedSkills.filter(s => s !== skill);
    setSelectedSkills(updatedSkills);
    form.setFormValues({ skills: updatedSkills });
  };
  
  // Handle selecting an existing skill
  const handleSelectExistingSkill = (e) => {
    const skill = e.target.value;
    if (skill && !selectedSkills.includes(skill)) {
      const updatedSkills = [...selectedSkills, skill];
      setSelectedSkills(updatedSkills);
      form.setFormValues({ skills: updatedSkills });
      e.target.value = ''; // Reset select
    }
  };
  
  // Switch between creating a new user or using an existing one
  const handleUserMethodChange = (e) => {
    setUserCreateMethod(e.target.value);
  };
  
  const TimeSelector = ({ label, name, field, onChange, value }) => (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        type="time"
        name={name}
        value={value}
        onChange={onChange}
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
      />
    </div>
  );
  
  // Update the form when user switches between using existing user or creating new user
  useEffect(() => {
    if (userCreateMethod === 'existing') {
      form.setFormValues({
        user_first_name: '',
        user_last_name: '',
        user_email: ''
      });
    } else if (userCreateMethod === 'new') {
      form.setFormValues({
        user_id: ''
      });
    }
  }, [userCreateMethod]);
  
  const handleAvailabilityUpdate = (dayOfWeek, field, value) => {
    const updatedAvailability = { ...form.values.default_availability };
    
    if (!updatedAvailability[dayOfWeek]) {
      updatedAvailability[dayOfWeek] = { start: '09:00', end: '17:00' };
    }
    
    if (field === 'enabled') {
      // If disabling, set to null
      updatedAvailability[dayOfWeek] = value ? { start: '09:00', end: '17:00' } : null;
    } else {
      // Update just the start or end time
      updatedAvailability[dayOfWeek] = { 
        ...updatedAvailability[dayOfWeek],
        [field]: value 
      };
    }
    
    form.setFormValues({ default_availability: updatedAvailability });
  };

  // Initialize all days of week with start/end times
  const updateAllDays = (startTime, endTime) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const updatedAvailability = { ...form.values.default_availability };
    
    days.forEach(day => {
      if (updatedAvailability[day]) {
        updatedAvailability[day] = {
          ...updatedAvailability[day],
          start: startTime,
          end: endTime
        };
      }
    });
    
    form.setFormValues({ default_availability: updatedAvailability });
  };
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6 text-gray-900 dark:text-gray-100">
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
              <h3 className="text-sm font-medium text-green-800">Technician {isEdit ? "updated" : "created"} successfully!</h3>
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
      
      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
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
      
      {!isEdit && (
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-md mb-6">
          <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200 mb-2">User Assignment</h3>
          
          <div className="mb-4">
            <div className="flex space-x-4 mb-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="userCreateMethod"
                  value="existing"
                  checked={userCreateMethod === 'existing'}
                  onChange={handleUserMethodChange}
                />
                <span className="ml-2 dark:text-gray-200">Use existing user</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="userCreateMethod"
                  value="new"
                  checked={userCreateMethod === 'new'}
                  onChange={handleUserMethodChange}
                />
                <span className="ml-2 dark:text-gray-200">Create new user</span>
              </label>
            </div>
            
            {userCreateMethod === 'existing' ? (
              <SelectInput
                label="User"
                name="user_id"
                value={form.values.user_id}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                error={form.touched.user_id && form.errors.user_id}
                options={users}
                isLoading={isLoadingUsers}
                loadingError={userError}
                emptyOption="Select User..."
                required
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TextInput
                  label="Email"
                  name="user_email"
                  type="email"
                  value={form.values.user_email}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  error={form.touched.user_email && form.errors.user_email}
                  required
                />
                <TextInput
                  label="First Name"
                  name="user_first_name"
                  value={form.values.user_first_name}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  error={form.touched.user_first_name && form.errors.user_first_name}
                  required
                />
                <TextInput
                  label="Last Name"
                  name="user_last_name"
                  value={form.values.user_last_name}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  error={form.touched.user_last_name && form.errors.user_last_name}
                  required
                />
              </div>
            )}
          </div>
        </div>
      )}
      
      {isEdit && (
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-md mb-6">
          <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200 mb-2">User Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <p className="mt-1 block w-full text-sm text-gray-900 dark:text-gray-200">
                {technician.user?.email || 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
              <p className="mt-1 block w-full text-sm text-gray-900 dark:text-gray-200">
                {technician.user?.first_name || 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
              <p className="mt-1 block w-full text-sm text-gray-900 dark:text-gray-200">
                {technician.user?.last_name || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TextInput
          label="Employee ID"
          name="employee_id"
          value={form.values.employee_id}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.employee_id && form.errors.employee_id}
          placeholder="Optional employee identifier"
        />
        
        <SelectInput
          label="Status"
          name="status"
          value={form.values.status}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.status && form.errors.status}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'on_leave', label: 'On Leave' }
          ]}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TextInput
          label="Hourly Rate"
          name="hourly_rate"
          type="number"
          step="0.01"
          min="0"
          value={form.values.hourly_rate}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.hourly_rate && form.errors.hourly_rate}
          placeholder="Hourly rate in dollars"
        />
        
        <TextInput
          label="Max Daily Jobs"
          name="max_daily_jobs"
          type="number"
          min="1"
          value={form.values.max_daily_jobs}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.max_daily_jobs && form.errors.max_daily_jobs}
        />
        
        <TextInput
          label="Service Radius"
          name="service_radius"
          type="number"
          step="0.1"
          min="0"
          value={form.values.service_radius}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.service_radius && form.errors.service_radius}
          placeholder="Service radius in miles"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills</label>
        <div className="mb-2 flex flex-wrap">
          {selectedSkills.map((skill) => (
            <div key={skill} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded px-2 py-1 m-1 flex items-center">
              {skill}
              <button 
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <FaMinus size={10} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Add existing skill</label>
            <div className="relative mt-1">
              <style jsx>{`
                select {
                  -webkit-appearance: none;
                  -moz-appearance: none;
                  appearance: none;
                }
                select::-ms-expand {
                  display: none;
                }
              `}</style>
              <select 
                className="appearance-none block w-full rounded-md shadow-sm pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                onChange={handleSelectExistingSkill}
                disabled={isLoadingSkills}
              >
                <option value="">Select a skill...</option>
                {skillsList?.map((skill) => (
                  <option key={skill.id} value={skill.name} className="dark:bg-gray-700 dark:text-white">{skill.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Add new skill</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full rounded-l-md sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="E.g., HVAC Installation"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                disabled={!newSkill.trim()}
                className="inline-flex items-center px-3 py-2 rounded-r-md border border-l-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-200 sm:text-sm"
              >
                <FaPlus className="mr-1" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <TextareaInput
          label="Notes"
          name="notes"
          rows={3}
          value={form.values.notes}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.notes && form.errors.notes}
          placeholder="Additional notes about this technician"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Certifications</label>
        <div className="mb-2">
          <textarea
            name="certifications"
            value={typeof form.values.certifications === 'object' 
              ? JSON.stringify(form.values.certifications, null, 2) 
              : form.values.certifications}
            onChange={(e) => {
              try {
                // Try to parse as JSON if it's a string
                const value = e.target.value;
                let parsedValue;
                
                // Only try to parse if it's not empty and looks like JSON
                if (value.trim() && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
                  parsedValue = JSON.parse(value);
                  
                  // Ensure it's an object and not an array
                  if (Array.isArray(parsedValue)) {
                    parsedValue = {}; // Convert arrays to empty objects
                  }
                } else {
                  parsedValue = value;
                }
                
                form.setFormValues({ certifications: parsedValue });
              } catch (err) {
                // If it's not valid JSON, just keep it as a string for now
                form.setFormValues({ certifications: e.target.value });
              }
            }}
            onBlur={(e) => {
              try {
                // On blur, try to ensure it's a valid object
                const value = e.target.value;
                
                if (!value.trim()) {
                  // If empty, set to empty object
                  form.setFormValues({ certifications: {} });
                  return;
                }
                
                // Try to parse as JSON
                const parsedValue = JSON.parse(value);
                
                // Ensure it's an object and not an array
                if (typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
                  form.setFieldError('certifications', 'Certifications must be a JSON object, not an array or primitive');
                } else {
                  // Valid object, update the form
                  form.setFormValues({ certifications: parsedValue });
                }
              } catch (err) {
                // Invalid JSON
                form.setFieldError('certifications', 'Invalid JSON format: ' + err.message);
              }
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            rows={5}
            placeholder="Enter certifications as JSON (e.g., {&quot;HVAC&quot;: &quot;Certified HVAC Technician&quot;, &quot;Electrical&quot;: &quot;Licensed Electrician&quot;})"
          />
          {form.touched.certifications && form.errors.certifications && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{form.errors.certifications}</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Certifications should be provided as a JSON object where keys are certification names and values are details.
            Example: {`{"HVAC": "Certified HVAC Technician", "Electrical": "Licensed Electrician"}`}
          </p>
        </div>
      </div>
      
      <div>
        <div className="flex justify-between items-center">
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
            onClick={() => setAvailabilityExpanded(!availabilityExpanded)}
          >
            {availabilityExpanded ? 'Hide Availability Settings' : 'Show Availability Settings'}
            <span className="ml-2">{availabilityExpanded ? '↑' : '↓'}</span>
          </button>
        </div>
        
        <div className={`mt-6 ${availabilityExpanded ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-1 gap-y-4 mb-4">
            {/* Work days */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-200">Work Days</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div key={day} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      className="form-checkbox rounded text-blue-600 dark:bg-gray-700 dark:border-gray-600"
                      checked={!!form.values.default_availability[day]}
                      onChange={(e) => handleAvailabilityUpdate(day, 'enabled', e.target.checked)}
                    />
                    <label className="text-sm capitalize dark:text-gray-300">{day}</label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Work hours */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-200">Default Work Hours</label>
              <div className="flex space-x-4">
                <TimeSelector 
                  label="Start Time" 
                  name="default_start" 
                  value={form.values.default_availability.monday?.start || '09:00'} 
                  onChange={(e) => updateAllDays(e.target.value, form.values.default_availability.monday?.end || '17:00')} 
                />
                <TimeSelector 
                  label="End Time" 
                  name="default_end" 
                  value={form.values.default_availability.monday?.end || '17:00'} 
                  onChange={(e) => updateAllDays(form.values.default_availability.monday?.start || '09:00', e.target.value)} 
                />
              </div>
            </div>
            
            {/* Advanced scheduling options would go here */}
            <div className="mt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Note: Exceptions to regular availability can be managed from the technician's detail page.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Form-level error */}
      {form.errors._form && (
        <div className="rounded-md bg-red-50 dark:bg-red-900 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{form.errors._form}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Form actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
          {isEdit ? 'Update Technician' : 'Create Technician'}
        </Button>
      </div>
    </form>
  );
}