import React, { useState, useEffect } from 'react';
import { apiClient } from '../../utils/api-client';
import Button from '../common/Button';
import TextInput from '../common/TextInput';
import SelectInput from '../common/SelectInput';
import TextareaInput from '../common/TextareaInput';
import CheckboxInput from '../common/CheckboxInput';
import NumberInput from '../common/NumberInput';
import Spinner from '../common/Spinner';

const ServiceForm = ({ service, onSubmit, onCancel }) => {
  const isEdit = !!service;
  const [formData, setFormData] = useState({
    sku_code: '',
    name: '',
    description: '',
    category: '',
    base_price: 0,
    unit: 'service',
    service_type: '',
    equipment_type: '',
    skill_level: '',
    duration_minutes: 0,
    is_bundle: false,
    is_custom_price: false,
    requires_diagnostic: false,
    prerequisites: [],
    is_active: true
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [generatingSkuCode, setGeneratingSkuCode] = useState(false);
  
  // Service type options (synced with backend enum)
  const serviceTypeOptions = [
    { value: '', label: 'Select Type' },
    { value: 'diagnostic', label: 'Diagnostic' },
    { value: 'repair', label: 'Repair' },
    { value: 'installation', label: 'Installation' },
    { value: 'additional_time', label: 'Additional Time' },
    { value: 'network', label: 'Network' },
    { value: 'remote', label: 'Remote' },
    { value: 'custom', label: 'Custom' }
  ];
  
  // Equipment type options (synced with backend enum)
  const equipmentTypeOptions = [
    { value: '', label: 'Select Equipment (if applicable)' },
    { value: 'washer', label: 'Washer' },
    { value: 'dryer', label: 'Dryer' },
    { value: 'stacked_laundry', label: 'Stacked Laundry' },
    { value: 'aio_laundry', label: 'All-In-One Laundry' },
    { value: 'refrigerator', label: 'Refrigerator' },
    { value: 'dishwasher', label: 'Dishwasher' },
    { value: 'range', label: 'Range' },
    { value: 'wall_oven', label: 'Wall Oven' },
    { value: 'tv', label: 'TV' },
    { value: 'network', label: 'Network' },
    { value: 'other', label: 'Other' }
  ];
  
  // Skill level options (synced with backend enum)
  const skillLevelOptions = [
    { value: '', label: 'Select Skill Level (if applicable)' },
    { value: 'basic', label: 'Basic' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];
  
  // Initialize form data with service values if editing
  useEffect(() => {
    if (isEdit && service) {
      setFormData({
        sku_code: service.sku_code || '',
        name: service.name || '',
        description: service.description || '',
        category: service.category || '',
        base_price: service.base_price || 0,
        unit: service.unit || 'service',
        service_type: service.service_type || '',
        equipment_type: service.equipment_type || '',
        skill_level: service.skill_level || '',
        duration_minutes: service.duration_minutes || 0,
        is_bundle: service.is_bundle || false,
        is_custom_price: service.is_custom_price || false,
        requires_diagnostic: service.requires_diagnostic || false,
        prerequisites: service.prerequisites || [],
        is_active: service.is_active !== false // Default to true if not explicitly false
      });
    }
  }, [isEdit, service]);
  
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };
  
  const generateSkuCode = async () => {
    if (!formData.service_type) {
      setErrors(prev => ({
        ...prev,
        service_type: 'Service type is required to generate SKU'
      }));
      return;
    }
    
    setGeneratingSkuCode(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('service_type', formData.service_type);
      
      if (formData.equipment_type) {
        params.append('equipment_type', formData.equipment_type);
      }
      
      const skuCode = await apiClient(`services/generate-sku?${params.toString()}`);
      
      if (typeof skuCode === 'string') {
        setFormData(prev => ({
          ...prev,
          sku_code: skuCode
        }));
      }
    } catch (err) {
      console.error('Error generating SKU code:', err);
      setErrors(prev => ({
        ...prev,
        sku_code: 'Failed to generate SKU code. Please try again or enter manually.'
      }));
    } finally {
      setGeneratingSkuCode(false);
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.sku_code.trim()) {
      newErrors.sku_code = 'SKU Code is required';
    }
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.service_type) {
      newErrors.service_type = 'Service type is required';
    }
    
    if (!formData.is_custom_price && (formData.base_price === undefined || formData.base_price < 0)) {
      newErrors.base_price = 'Base price must be a non-negative number';
    }
    
    if (formData.duration_minutes < 0) {
      newErrors.duration_minutes = 'Duration must be a non-negative number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      const data = { ...formData };
      
      // Format prerequisites as a JSON string if it's not already
      if (Array.isArray(data.prerequisites)) {
        data.prerequisites = data.prerequisites.filter(p => p.trim() !== '');
      }
      
      if (isEdit) {
        // Update existing service
        await apiClient(`services/${service.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      } else {
        // Create new service
        await apiClient(`services`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
      
      onSubmit(data);
    } catch (err) {
      console.error('Error saving service:', err);
      
      // Handle validation errors from the server
      if (err.data?.validationErrors) {
        setErrors(err.data.validationErrors);
      } else if (err.message) {
        // Handle conflict errors
        if (err.message.includes('already exists')) {
          setErrors({
            sku_code: 'This SKU code is already in use'
          });
        } else {
          setErrors({
            _form: err.message
          });
        }
      } else {
        setErrors({
          _form: 'An error occurred while saving the service. Please try again.'
        });
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      {errors._form && (
        <div className="bg-red-50 dark:bg-red-900 p-3 rounded-md">
          <p className="text-red-800 dark:text-red-200 text-sm">{errors._form}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <TextInput
            label="SKU Code"
            value={formData.sku_code}
            onChange={(e) => handleInputChange('sku_code', e.target.value.toUpperCase())}
            error={errors.sku_code}
            helpText="Unique identifier for this service"
            required
            appendButton={
              <Button
                type="button"
                variant="secondary"
                onClick={generateSkuCode}
                disabled={generatingSkuCode || !formData.service_type}
                className="h-full"
              >
                {generatingSkuCode ? <Spinner size="sm" /> : 'Generate'}
              </Button>
            }
          />
        </div>
        
        <div>
          <TextInput
            label="Name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            error={errors.name}
            required
          />
        </div>
        
        <div className="md:col-span-2">
          <TextareaInput
            label="Description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            error={errors.description}
            rows={3}
          />
        </div>
        
        <div>
          <SelectInput
            label="Service Type"
            value={formData.service_type}
            onChange={(e) => handleInputChange('service_type', e.target.value)}
            options={serviceTypeOptions}
            error={errors.service_type}
            required
          />
        </div>
        
        <div>
          <SelectInput
            label="Equipment Type"
            value={formData.equipment_type}
            onChange={(e) => handleInputChange('equipment_type', e.target.value)}
            options={equipmentTypeOptions}
            error={errors.equipment_type}
          />
        </div>
        
        <div>
          <NumberInput
            label="Base Price ($)"
            value={formData.base_price}
            onChange={(value) => handleInputChange('base_price', value)}
            min={0}
            step={0.01}
            disabled={formData.is_custom_price}
            error={errors.base_price}
          />
        </div>
        
        <div>
          <NumberInput
            label="Duration (minutes)"
            value={formData.duration_minutes}
            onChange={(value) => handleInputChange('duration_minutes', value)}
            min={0}
            error={errors.duration_minutes}
          />
        </div>
        
        <div>
          <SelectInput
            label="Skill Level"
            value={formData.skill_level}
            onChange={(e) => handleInputChange('skill_level', e.target.value)}
            options={skillLevelOptions}
            error={errors.skill_level}
          />
        </div>
        
        <div>
          <TextInput
            label="Category"
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
            error={errors.category}
            helpText="Optional grouping category"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CheckboxInput
          label="Variable Pricing"
          checked={formData.is_custom_price}
          onChange={(e) => handleInputChange('is_custom_price', e.target.checked)}
          helpText="Price will be set at time of service"
        />
        
        <CheckboxInput
          label="Requires Diagnostic"
          checked={formData.requires_diagnostic}
          onChange={(e) => handleInputChange('requires_diagnostic', e.target.checked)}
          helpText="A diagnostic service should be performed first"
        />
        
        <CheckboxInput
          label="Active"
          checked={formData.is_active}
          onChange={(e) => handleInputChange('is_active', e.target.checked)}
          helpText="Service is available for selection"
        />
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button variant="secondary" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={loading}
          className="min-w-32"
        >
          {loading ? <Spinner size="sm" /> : isEdit ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </form>
  );
};

export default ServiceForm; 