// Mock dashboard data API endpoint
export default async function handler(req, res) {
  try {
    // Generate random data for a more realistic mock
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    
    // Mock data that matches the structure from the backend API
    res.json({
      // Work orders stats
      work_orders: {
        total: 35,
        pending: 12,
        completed: 23
      },
      
      // Revenue stats
      revenue: {
        this_month: 28500,
        previous_month: 25200,
        growth_percentage: 13.1,
        outstanding_invoices: 8750
      },
      
      // Client stats
      clients: {
        total: 48,
        active: 32,
        new_this_month: 4
      },
      
      // Technician stats
      technicians: {
        total: 8,
        available: 5,
        busy: 3
      },
      
      // For backwards compatibility with the old dashboard
      clientCount: 32,
      workOrdersCount: 12,
      revenueMonth: 28500,
      openQuotesCount: 7,
      
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
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
} 