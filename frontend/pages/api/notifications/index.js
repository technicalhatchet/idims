// Mock notifications API endpoint
export default async function handler(req, res) {
  try {
    // Return mock notifications data
    res.json({
      unread_count: 3,
      notifications: [
        {
          id: 1,
          type: 'job_scheduled',
          title: 'Job Scheduled',
          message: 'New job #WO-2023-098 has been scheduled for tomorrow at 10:00 AM',
          created_at: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          read: false
        },
        {
          id: 2,
          type: 'quote_accepted',
          title: 'Quote Accepted',
          message: 'Client ABC Company has accepted quote #Q-2023-054',
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          read: false
        },
        {
          id: 3, 
          type: 'payment_received',
          title: 'Payment Received',
          message: 'Payment of $1,250.00 received for invoice #INV-2023-072',
          created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          read: false
        },
        {
          id: 4,
          type: 'system_maintenance',
          title: 'System Maintenance',
          message: 'Scheduled maintenance will occur on Sunday at 2:00 AM',
          created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          read: true
        }
      ]
    });
  } catch (error) {
    console.error('Notifications API error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
} 