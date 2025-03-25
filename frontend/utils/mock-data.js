/**
 * Mock data generator for development
 * 
 * This file provides mock data for various API endpoints when working in development mode.
 * It helps developers work on the frontend without requiring a working backend API.
 */

/**
 * Generate mock dashboard data
 * 
 * @returns {Object} Mock dashboard data object
 */
export const generateMockDashboardData = () => {
  // Generate random data for a more realistic mock
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  
  // Mock data that matches the structure from the backend API
  return {
    // Work orders stats
    work_orders: {
      total: Math.floor(Math.random() * 20) + 30,
      pending: Math.floor(Math.random() * 10) + 10,
      completed: Math.floor(Math.random() * 15) + 15
    },
    
    // Revenue stats
    revenue: {
      this_month: Math.floor(Math.random() * 15000) + 20000,
      previous_month: Math.floor(Math.random() * 15000) + 15000,
      growth_percentage: Math.floor(Math.random() * 20) + 5,
      outstanding_invoices: Math.floor(Math.random() * 5000) + 5000
    },
    
    // Client stats
    clients: {
      total: Math.floor(Math.random() * 20) + 40,
      active: Math.floor(Math.random() * 15) + 25,
      new_this_month: Math.floor(Math.random() * 5) + 2
    },
    
    // Technician stats
    technicians: {
      total: Math.floor(Math.random() * 5) + 5,
      available: Math.floor(Math.random() * 3) + 3,
      busy: Math.floor(Math.random() * 2) + 2
    },
    
    // For backwards compatibility with the old dashboard
    clientCount: Math.floor(Math.random() * 15) + 25,
    workOrdersCount: Math.floor(Math.random() * 10) + 10,
    revenueMonth: Math.floor(Math.random() * 15000) + 20000,
    openQuotesCount: Math.floor(Math.random() * 5) + 5,
    
    // Sample data for recent work orders
    recentWorkOrders: [
      { id: 1, title: 'HVAC Installation', client: 'Acme Corp', status: 'in_progress' },
      { id: 2, title: 'Electrical Maintenance', client: 'Smith Residence', status: 'completed' },
      { id: 3, title: 'Plumbing Repair', client: 'City Hospital', status: 'pending' },
      { id: 4, title: 'Security System Update', client: 'Tech Solutions Inc', status: 'completed' }
    ],
    
    // Sample data for upcoming appointments
    upcomingAppointments: [
      { id: 101, title: 'Initial Consultation', client: 'New Client LLC', date: 'Oct 15', time: '10:00 AM' },
      { id: 102, title: 'Annual Maintenance', client: 'John\'s Diner', date: 'Oct 17', time: '2:30 PM' },
      { id: 103, title: 'Emergency Repair', client: 'Downtown Offices', date: 'Oct 12', time: '9:00 AM' }
    ]
  };
};

/**
 * Generate mock user data
 * 
 * @param {string} role - The role to assign to the mock user
 * @returns {Object} Mock user object
 */
export const generateMockUser = (role = 'client') => {
  return {
    sub: 'mock-user-id',
    name: 'Mock User',
    email: 'mock@example.com',
    picture: 'https://via.placeholder.com/150',
    app_metadata: {
      role: role
    },
    updated_at: new Date().toISOString()
  };
};

/**
 * Check if mock mode is enabled
 * 
 * @returns {boolean} True if mock mode is enabled
 */
export const isMockModeEnabled = () => {
  return process.env.NODE_ENV === 'development' && 
         process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';
}; 