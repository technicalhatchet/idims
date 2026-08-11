import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaUserClock, FaTimes } from 'react-icons/fa';
import { format, addMinutes, parseISO } from 'date-fns';
import Select from 'react-select';
import { apiClient } from '../../utils/api-client';
import { sumPlannedDurationMinutes } from '../../utils/visitSku';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorAlert from '../ui/ErrorAlert';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { TextInput, SelectInput, TextareaInput } from '../ui/FormElements';

export default function AppointmentsTab({ workOrderId, onUpdate }) {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  
  const [allServices, setAllServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('');
  const [servicesForSelectedCategory, setServicesForSelectedCategory] = useState([]);

  const initialFormData = {
    work_order_id: workOrderId,
    appointment_type: 'diagnostic',
    status: 'scheduled',
    scheduled_start: '',
    scheduled_end: '',
    assigned_technician_id: '',
    travel_time_before: '',
    travel_time_after: '',
    travel_distance_before: '',
    travel_distance_after: '',
    service_ids: [],
    notes: ''
  };
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [updatingStatus, setUpdatingStatus] = useState(null); // Track which appointment is being updated

  useEffect(() => {
    if (workOrderId) {
      fetchAppointments();
      fetchTechnicians();
    }
  }, [workOrderId]);

  useEffect(() => {
    if (allServices.length > 0) {
      const categories = [...new Set(allServices.map(service => service.type).filter(type => type))];
      setServiceCategories(categories.sort());
    } else {
      setServiceCategories([]);
    }
  }, [allServices]);

  useEffect(() => {
    if (selectedServiceCategory && allServices.length > 0) {
      setServicesForSelectedCategory(
        allServices.filter(service => service.type === selectedServiceCategory)
      );
    } else {
      setServicesForSelectedCategory([]);
    }
    setFormData(prev => ({ ...prev, service_ids: [] }));
  }, [selectedServiceCategory, allServices]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient(`/api/work-orders/${workOrderId}/appointments`);
      setAppointments(response.items || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const response = await apiClient('/api/technicians');
      if (response.items) {
        setTechnicians(response.items);
      }
    } catch (err) {
      console.error('Error fetching technicians:', err);
    }
  };

  const fetchServices = async () => {
    if (allServices.length > 0 && !servicesLoading) return;
    setServicesLoading(true);
    try {
      const response = await apiClient('/api/services?limit=500&is_active=true');
      setAllServices(response.items || []);
    } catch (err) {
      console.error('Error fetching services:', err);
    } finally {
      setServicesLoading(false);
    }
  };

  const openAppointmentModal = (appointment = null) => {
    fetchServices();

    if (appointment) {
      setCurrentAppointment(appointment);
      setFormData({
        work_order_id: workOrderId,
        appointment_type: appointment.appointment_type,
        status: appointment.status,
        scheduled_start: formatDateTimeForInput(appointment.scheduled_start),
        scheduled_end: formatDateTimeForInput(appointment.scheduled_end),
        assigned_technician_id: appointment.assigned_technician_id || '',
        actual_start: appointment.actual_start ? formatDateTimeForInput(appointment.actual_start) : '',
        actual_end: appointment.actual_end ? formatDateTimeForInput(appointment.actual_end) : '',
        travel_time_before: appointment.travel_time_before || '',
        travel_time_after: appointment.travel_time_after || '',
        travel_distance_before: appointment.travel_distance_before || '',
        travel_distance_after: appointment.travel_distance_after || '',
        notes: appointment.notes || '',
        service_ids: appointment.services ? appointment.services.map(s => s.id) : [],
      });
    } else {
      setCurrentAppointment(null);
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
      if (defaultStart < now) {
        defaultStart.setDate(defaultStart.getDate() + 1);
      }
      const defaultEnd = addMinutes(
        defaultStart,
        sumPlannedDurationMinutes([], allServices),
      );

      setFormData({
        ...initialFormData,
        work_order_id: workOrderId,
        scheduled_start: formatDateTimeForInput(defaultStart),
        scheduled_end: formatDateTimeForInput(defaultEnd),
      });
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  const formatDateTimeForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '' : format(date, "yyyy-MM-dd'T'HH:mm");
    } catch (e) {
      return '';
    }
  };

  const computeScheduledEndForStart = (scheduledStart, serviceIds) => {
    if (!scheduledStart) return '';
    try {
      const minutes = sumPlannedDurationMinutes(serviceIds, allServices);
      return formatDateTimeForInput(addMinutes(parseISO(scheduledStart), minutes));
    } catch {
      return '';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'scheduled_start') {
      setFormData((prev) => ({
        ...prev,
        scheduled_start: value,
        scheduled_end: computeScheduledEndForStart(value, prev.service_ids),
      }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleServiceCategoryChange = (e) => {
    setSelectedServiceCategory(e.target.value);
  };

  const handleServiceChange = (selectedOptions) => {
    const serviceIds = selectedOptions ? selectedOptions.map((opt) => opt.value) : [];
    setFormData((prev) => ({
      ...prev,
      service_ids: serviceIds,
      scheduled_end: prev.scheduled_start
        ? computeScheduledEndForStart(prev.scheduled_start, serviceIds)
        : prev.scheduled_end,
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.appointment_type) errors.appointment_type = 'Appointment type is required';
    if (!formData.scheduled_start) errors.scheduled_start = 'Start time is required';
    if (formData.scheduled_start && formData.scheduled_end && new Date(formData.scheduled_end) <= new Date(formData.scheduled_start)) {
      errors.scheduled_end = 'End time must be after start time if manually entered';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setError(null);

    const payload = {
      ...formData,
      travel_time_before: formData.travel_time_before ? parseInt(formData.travel_time_before) : null,
      travel_time_after: formData.travel_time_after ? parseInt(formData.travel_time_after) : null,
      travel_distance_before: formData.travel_distance_before ? parseInt(formData.travel_distance_before) : null,
      travel_distance_after: formData.travel_distance_after ? parseInt(formData.travel_distance_after) : null,
      service_ids: formData.service_ids || [],
    };
    
    try {
      if (currentAppointment) {
        await apiClient(`/api/appointments/${currentAppointment.id}`, { method: 'PUT', body: payload });
      } else {
        await apiClient(`/api/work-orders/${workOrderId}/appointments`, { method: 'POST', body: payload });
      }
      fetchAppointments();
      setIsModalOpen(false);
      if (onUpdate && typeof onUpdate === 'function') onUpdate();
    } catch (err) {
      console.error('Error saving appointment:', err);
      const errorDetail = err.response?.data?.detail || 'Failed to save appointment. Please try again.';
      setError(errorDetail);
      setFormErrors(err.response?.data?.errors || {});
    }
  };

  const handleDelete = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to delete this appointment?')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      await apiClient(`/api/work-orders/appointments/${appointmentId}`, {
        method: 'DELETE'
      });
      
      await fetchAppointments();
      
      if (onUpdate) onUpdate();
      
    } catch (err) {
      console.error('Error deleting appointment:', err);
      setError('Failed to delete appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    setUpdatingStatus(appointmentId);
    setError(null);
    
    try {
      await apiClient(`/api/work-orders/appointments/${appointmentId}`, {
        method: 'PUT',
        body: { status: newStatus }
      });
      
      // Update the local state immediately for better UX
      setAppointments(prev => 
        prev.map(appointment => 
          appointment.id === appointmentId 
            ? { ...appointment, status: newStatus }
            : appointment
        )
      );
      
      if (onUpdate && typeof onUpdate === 'function') onUpdate();
      
    } catch (err) {
      console.error('Error updating appointment status:', err);
      const errorDetail = err.response?.data?.detail || 'Failed to update appointment status. Please try again.';
      setError(errorDetail);
      // Refresh appointments to revert any optimistic updates
      await fetchAppointments();
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'canceled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'reschedule': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (isLoading && appointments.length === 0) {
    return <LoadingSpinner />;
  }

  if (error && appointments.length === 0) {
    return <ErrorAlert message={error} onRetry={fetchAppointments} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Appointments</h2>
        <Button onClick={() => openAppointmentModal()} variant="primary" size="sm" Icon={FaPlus}>
          Add Appointment
        </Button>
      </div>
      
      <div className="px-6 py-5">
        {appointments.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 dark:text-gray-400">No appointments scheduled yet.</p>
            <button 
              onClick={() => openAppointmentModal()}
              className="mt-3 text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Schedule an appointment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Technician</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      <div className="capitalize">{appointment.appointment_type}</div>
                      {appointment.services?.length > 0 && (
                        <div className="text-xs text-cyan-500 dark:text-cyan-400 font-normal mt-0.5">
                          {appointment.services.map(s => s.name).join(', ')}
                        </div>
                      )}
                      {appointment.notes && (
                        <div className="text-xs text-gray-400 italic mt-0.5 max-w-xs truncate">
                          {appointment.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(appointment.scheduled_start), 'MMM d, yyyy h:mm a')} - 
                      {format(new Date(appointment.scheduled_end), 'h:mm a')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <select
                        value={appointment.status}
                        onChange={(e) => handleStatusUpdate(appointment.id, e.target.value)}
                        disabled={updatingStatus === appointment.id}
                        className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${getStatusColor(appointment.status)} ${
                          updatingStatus === appointment.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="canceled">Canceled</option>
                        <option value="reschedule">Reschedule</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {appointment.technician_name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                      <button
                        onClick={() => openAppointmentModal(appointment)}
                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                        title="Edit appointment"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(appointment.id)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete appointment"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentAppointment ? 'Edit Appointment' : 'Schedule New Appointment'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}
          <div>
            <SelectInput
              label="Appointment Type"
              name="appointment_type"
              value={formData.appointment_type}
              onChange={handleInputChange}
              error={formErrors.appointment_type}
              required
            >
              <option value="">Select appointment type</option>
              <option value="diagnostic">Diagnostic</option>
              <option value="repair">Repair</option>
              <option value="follow-up">Follow-up</option>
              <option value="inspection">Inspection</option>
              <option value="maintenance">Maintenance</option>
            </SelectInput>
          </div>
          
          <div>
            <SelectInput
              label="Service Category"
              name="service_category"
              value={selectedServiceCategory}
              onChange={handleServiceCategoryChange}
            >
              <option value="">Select service category</option>
              {serviceCategories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}
                </option>
              ))}
            </SelectInput>
          </div>
          
          <div>
            <label htmlFor="service_ids" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Services/SKUs
            </label>
            {servicesLoading && !selectedServiceCategory ? (
              <LoadingSpinner size="small" />
            ) : !selectedServiceCategory ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Please select a service category first.</p>
            ) : servicesForSelectedCategory.length === 0 && selectedServiceCategory ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No services found for this category.</p>
            ) : (
              <Select
                id="service_ids"
                isMulti
                options={servicesForSelectedCategory.map(service => ({ 
                  value: service.id, 
                  label: `${service.name} (${service.sku_code || 'N/A'}) - ${service.duration_minutes || 0} min` 
                }))}
                value={servicesForSelectedCategory
                  .filter(service => formData.service_ids.includes(service.id))
                  .map(s => ({ value: s.id, label: `${s.name} (${s.sku_code || 'N/A'}) - ${s.duration_minutes || 0} min` }))
                }
                onChange={handleServiceChange}
                className="basic-multi-select"
                classNamePrefix="select"
                placeholder="Select services..."
                isDisabled={!selectedServiceCategory || servicesLoading}
              />
            )}
            {formErrors.service_ids && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.service_ids}</p>}
          </div>
          
          <div>
            <SelectInput
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              error={formErrors.status}
              required
            >
              <option value="scheduled">Scheduled</option>
              <option value="reschedule">Reschedule</option>
              <option value="completed">Completed</option>
              <option value="canceled">Canceled</option>
            </SelectInput>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <TextInput
                label="Scheduled Start"
                name="scheduled_start"
                type="datetime-local"
                value={formData.scheduled_start}
                onChange={handleInputChange}
                error={formErrors.scheduled_start}
                required
              />
            </div>
            <div>
              <TextInput
                label="Scheduled End (updates from SKU duration when start changes)"
                name="scheduled_end"
                type="datetime-local"
                value={formData.scheduled_end}
                onChange={handleInputChange}
                error={formErrors.scheduled_end}
              />
            </div>
          </div>
          
          <div>
            <SelectInput
              label="Assigned Technician"
              name="assigned_technician_id"
              value={formData.assigned_technician_id}
              onChange={handleInputChange}
              error={formErrors.assigned_technician_id}
            >
              <option value="">Select technician</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id}>
                  {tech.user?.first_name ? `${tech.user.first_name} ${tech.user.last_name}` : tech.name || 'Unnamed technician'}
                </option>
              ))}
            </SelectInput>
          </div>
          
          {currentAppointment && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <TextInput
                  label="Actual Start Time"
                  name="actual_start"
                  type="datetime-local"
                  value={formData.actual_start}
                  onChange={handleInputChange}
                  placeholder="Leave blank if not started"
                />
              </div>
              <div>
                <TextInput
                  label="Actual End Time"
                  name="actual_end"
                  type="datetime-local"
                  value={formData.actual_end}
                  onChange={handleInputChange}
                  placeholder="Leave blank if not completed"
                />
              </div>
            </div>
          )}
          
          <TextareaInput
            label="Notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
          />
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              Icon={FaTimes}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              Icon={FaCalendarAlt}
              isLoading={isLoading}
            >
              {currentAppointment ? 'Update Appointment' : 'Schedule Appointment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
} 