import { useState, useEffect } from 'react';
import { useForm } from '@/hooks/useForm';
import { TextInput, SelectInput, TextareaInput, Checkbox, Button } from '@/components/ui/FormElements';
import { FaSave, FaTimes, FaPlus, FaMinus } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { useSkills } from '@/hooks/useTechnicians';
import { apiClient } from '@/utils/fetchWithAuth';

export default function TechnicianForm({ initialData, isEdit = false }) {
  const router = useRouter();
  const [availabilityExpanded, setAvailabilityExpanded] = useState(false);
  const [userCreateMethod, setUserCreateMethod] = useState('existing');
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userError, setUserError] = useState(null);
  
  // Get skills list
  const { data: skillsList, isLoading: isLoadingSkills } = useSkills();
  
  // Selected skills state
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  
  // Initialize form with default values or provided data
  const defaultValues = {
    user_id: '',
    user_email: '',
    user_first_name: '',
    user_last_name: '',
    employee_id: '',
    hourly_rate: '',
    max_daily_jobs: '8',
    service_radius: '',
    notes: '',
    status: 'active',
    skills: [],
    availability: {
      workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      workHours: {
        start: '08:00',
        end: '17:00'
      },
      exceptions: []
    }
  };
  
  // Prepare initial form values
  const getInitialValues = () => {
    if (!initialData) return defaultValues;
    
    // Convert skills to array if it's a string
    const skills = Array.isArray(initialData.skills) 
      ? initialData.skills 
      : (initialData.skills ? [initialData.skills] : []);
    
    setSelectedSkills(skills);
    
    return {
      user_id: initialData.user_id || '',
      employee_id: initialData.employee_id || '',
      hourly_rate: initialData.hourly_rate?.toString() || '',
      max_daily_jobs: initialData.max_daily_jobs?.toString() || '8',
      service_radius: initialData.service_radius?.toString() || '',
      notes: initialData.notes || '',
      status: initialData.status || 'active',
      skills: skills,
      availability: initialData.availability || defaultValues.availability
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
    
    return errors;
  };
  
  // Form submission handler
  const handleSubmit = async (values) => {
    try {
      // Prepare submission data
      const technicianData = {
        ...values,
        hourly_rate: values.hourly_rate ? parseFloat(values.hourly_rate) : undefined,
        max_daily_jobs: values.max_daily_jobs ? parseInt(values.max_daily_jobs) : undefined,
        service_radius: values.service_radius ? parseFloat(values.service_radius) : undefined,
        skills: selectedSkills
      };
      
      // If creating new technician from existing user
      if (userCreateMethod === 'existing') {
        delete technicianData.user_email;
        delete technicianData.user_first_name;
        delete technicianData.user_last_name;
      } 
      // If creating new technician with new user
      else if (userCreateMethod === 'new') {
        delete technicianData.user_id;
      }
      
      if (isEdit) {
        // Update existing technician
        await apiClient(`/api/technicians/${initialData.id}`, {
          method: 'PUT',
          body: JSON.stringify(technicianData),
        });
        
        router.push(`/technicians/${initialData.id}`);
      } else {
        // Create new technician
        const response = await apiClient('/api/technicians', {
          method: 'POST',
          body: JSON.stringify(technicianData),
        });
        
        router.push(`/technicians/${response.id}`);
      }
    } catch (error) {
      console.error('Error saving technician:', error);
      throw error;
    }
  };
  
  const form = useForm(getInitialValues(), handleSubmit, validate);
  
  // Load users for dropdown
  useEffect(() => {
    const loadUsers = async () => {
      if (userCreateMethod !== 'existing') return;
      
      setIsLoadingUsers(true);
      setUserError(null);
      
      try {
        const data = await apiClient('/api/users?limit=100');
        
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
  
  return (
    <form onSubmit={form.handleSubmit} className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-md mb-6">
        <h3 className="text-lg font-medium text-blue-800 mb-2">User Assignment</h3>
        
        {!isEdit && (
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
                <span className="ml-2">Use existing user</span>
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
                <span className="ml-2">Create new user</span>
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
        )}
      </div>
      
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Skills</label>
        <div className="mb-2 flex flex-wrap">
          {selectedSkills.map((skill) => (
            <div key={skill} className="bg-blue-100 text-blue-800 text-sm rounded px-2 py-1 m-1 flex items-center">
              {skill}
              <button 
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                <FaMinus size={10} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Add existing skill</label>
            <select 
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              onChange={handleSelectExistingSkill}
              disabled={isLoadingSkills}
            >
              <option value="">Select a skill...</option>
              {skillsList?.filter(skill => !selectedSkills.includes(skill)).map((skill) => (
                <option key={skill} value={skill}>{skill}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Add new skill</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                placeholder="Enter new skill"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm hover:bg-gray-100"
              >
                <FaPlus />
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
        
        {availabilityExpanded && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md">
            <h4 className="font-medium mb-3">Default Working Days</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                <label key={day} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox rounded text-blue-600"
                    checked={form.values.availability.workDays.includes(day)}
                    onChange={(e) => {
                      const workDays = e.target.checked
                        ? [...form.values.availability.workDays, day]
                        : form.values.availability.workDays.filter(d => d !== day);
                      
                      form.setFormValues({
                        availability: {
                          ...form.values.availability,
                          workDays
                        }
                      });
                    }}
                  />
                  <span className="ml-2 capitalize">{day}</span>
                </label>
              ))}
            </div>
            
            <h4 className="font-medium mb-3">Working Hours</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Time</label>
                <input
                  type="time"
                  value={form.values.availability.workHours.start}
                  onChange={(e) => {
                    form.setFormValues({
                      availability: {
                        ...form.values.availability,
                        workHours: {
                          ...form.values.availability.workHours,
                          start: e.target.value
                        }
                      }
                    });
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Time</label>
                <input
                  type="time"
                  value={form.values.availability.workHours.end}
                  onChange={(e) => {
                    form.setFormValues({
                      availability: {
                        ...form.values.availability,
                        workHours: {
                          ...form.values.availability.workHours,
                          end: e.target.value
                        }
                      }
                    });
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            
            {/* Add exceptions UI if needed */}
          </div>
        )}
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
              <h3 className="text-sm font-medium text-gray-500">Notes</h3>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">{technician.notes}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Availability</h2>
        </div>
        
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Working Days</h3>
              <div className="mt-2 flex flex-wrap">
                {technician.availability?.workDays?.map((day, index) => (
                  <span key={index} className="bg-green-100 text-green-800 text-xs font-medium mr-2 mb-2 px-2.5 py-0.5 rounded capitalize">
                    {day}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Working Hours</h3>
              <p className="mt-1 text-sm text-gray-900">
                {technician.availability?.workHours 
                  ? `${technician.availability.workHours.start} - ${technician.availability.workHours.end}`
                  : 'Default working hours'
                }
              </p>
            </div>
          </div>
          
          {technician.availability?.exceptions?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Exceptions</h3>
              <div className="border rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Available
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Working Hours
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {technician.availability.exceptions.map((exception, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {exception.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {exception.available ? 'Yes' : 'No'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {exception.working_hours
                            ? `${exception.working_hours.start} - ${exception.working_hours.end}`
                            : '-'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {exception.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}