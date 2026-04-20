import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Table, 
  Button, 
  Input, 
  Select, 
  Pagination,
  Spinner,
  Modal,
  Alert
} from '../../components/ui';
import apiClient from '../../utils/apiClient';

const ServiceList = () => {
  const router = useRouter();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    service_type: '',
    equipment_type: '',
    skill_level: ''
  });
  const [serviceTypes, setServiceTypes] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [skillLevels, setSkillLevels] = useState([]);
  
  // Fetch services
  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        page_size: pageSize,
        search: search,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      });
      
      const response = await apiClient(`services?${params.toString()}`);
      setServices(response.items || []);
      setTotalPages(Math.ceil(response.total / pageSize));
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('Failed to load services. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch enum values for dropdowns
  const fetchEnumValues = async () => {
    try {
      const [serviceTypesRes, equipmentTypesRes, skillLevelsRes] = await Promise.all([
        apiClient('enums/service-types'),
        apiClient('enums/equipment-types'),
        apiClient('enums/service-skill-levels')
      ]);
      
      setServiceTypes(serviceTypesRes || []);
      setEquipmentTypes(equipmentTypesRes || []);
      setSkillLevels(skillLevelsRes || []);
    } catch (err) {
      console.error('Error fetching enum values:', err);
    }
  };
  
  useEffect(() => {
    fetchEnumValues();
  }, []);
  
  useEffect(() => {
    fetchServices();
  }, [currentPage, pageSize, filters]);
  
  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    fetchServices();
  };
  
  // Handle filter change
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };
  
  // Navigate to service details
  const viewService = (id) => {
    router.push(`/services/${id}`);
  };
  
  // Create new service
  const createService = () => {
    router.push('/services/new');
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Services</h1>
        <Button 
          variant="primary" 
          onClick={createService}
        >
          Create Service
        </Button>
      </div>
      
      {error && <Alert variant="error">{error}</Alert>}
      
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/3">
          <Input
            placeholder="Search by name or SKU"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            endIcon={
              <button onClick={handleSearch} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            }
          />
        </div>
        
        <div className="w-full md:w-1/5">
          <Select
            placeholder="Service Type"
            value={filters.service_type}
            onChange={e => handleFilterChange('service_type', e.target.value)}
          >
            <option value="">All Types</option>
            {serviceTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        </div>
        
        <div className="w-full md:w-1/5">
          <Select
            placeholder="Equipment Type"
            value={filters.equipment_type}
            onChange={e => handleFilterChange('equipment_type', e.target.value)}
          >
            <option value="">All Equipment</option>
            {equipmentTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
        </div>
        
        <div className="w-full md:w-1/5">
          <Select
            placeholder="Skill Level"
            value={filters.skill_level}
            onChange={e => handleFilterChange('skill_level', e.target.value)}
          >
            <option value="">All Levels</option>
            {skillLevels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </Select>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.Cell>SKU</Table.Cell>
                  <Table.Cell>Name</Table.Cell>
                  <Table.Cell>Type</Table.Cell>
                  <Table.Cell>Equipment</Table.Cell>
                  <Table.Cell>Duration</Table.Cell>
                  <Table.Cell>Price</Table.Cell>
                  <Table.Cell>Skill Level</Table.Cell>
                  <Table.Cell>Actions</Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {services.length > 0 ? (
                  services.map(service => (
                    <Table.Row key={service.id}>
                      <Table.Cell className="font-mono">{service.sku_code || 'N/A'}</Table.Cell>
                      <Table.Cell>{service.name}</Table.Cell>
                      <Table.Cell>{service.service_type || 'N/A'}</Table.Cell>
                      <Table.Cell>{service.equipment_type || 'N/A'}</Table.Cell>
                      <Table.Cell>{service.duration_minutes} min</Table.Cell>
                      <Table.Cell>${service.price.toFixed(2)}</Table.Cell>
                      <Table.Cell>{service.skill_level || 'Standard'}</Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => viewService(service.id)}
                        >
                          View
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))
                ) : (
                  <Table.Row>
                    <Table.Cell colSpan={8} className="text-center py-4">
                      No services found.
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <div>
                <Select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-24"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
                <span className="ml-2 text-sm text-gray-600">
                  items per page
                </span>
              </div>
              
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ServiceList; 