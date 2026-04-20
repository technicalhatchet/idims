// frontend/pages/api/dashboard/stats.js
// Temporarily comment out Auth0 until backend integration is complete
// import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import db from '../../../utils/db';

async function fetchDashboardStats() {
  try {
    console.log('Attempting database connection...');
    console.log('Using DATABASE_URL:', process.env.DATABASE_URL); // This will be hidden in logs
    
    // Test database connection first
    const testConnection = await db.query('SELECT NOW()');
    console.log('Database connection successful:', testConnection.rows[0]);
    
    // Fetch work orders stats with correct status values
    const workOrdersStats = await db.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status IN ('pending', 'scheduled') THEN 1 END) as pending_count,
        COUNT(CASE WHEN DATE(scheduled_start) = CURRENT_DATE THEN 1 END) as today_count,
        COUNT(CASE WHEN DATE(scheduled_start) = CURRENT_DATE AND status = 'completed' THEN 1 END) as today_completed
      FROM work_orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    console.log('Work orders stats:', workOrdersStats.rows[0]);

    // Fetch invoice stats with correct column names
    const invoiceStats = await db.query(`
      SELECT 
        COUNT(CASE WHEN status IN ('draft', 'sent') THEN 1 END) as pending_count,
        COALESCE(SUM(CASE WHEN status IN ('draft', 'sent') THEN total ELSE 0 END), 0) as pending_value,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', issue_date) = DATE_TRUNC('month', CURRENT_DATE) THEN total ELSE 0 END), 0) as monthly_revenue
      FROM invoices
    `);
    console.log('Invoice stats:', invoiceStats.rows[0]);

    // Fetch recent activity
    const recentActivity = await db.query(`
      SELECT 
        'work_order' as type,
        id,
        status::text as description,
        created_at as timestamp,
        id as link_id
      FROM work_orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT 
        'invoice' as type,
        id,
        status::text as description,
        created_at as timestamp,
        id as link_id
      FROM invoices
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY timestamp DESC
      LIMIT 5
    `);
    console.log('Recent activity count:', recentActivity.rows.length);

    // Format the activity descriptions in JavaScript instead of SQL
    const formattedActivity = recentActivity.rows.map(activity => ({
      id: activity.id,
      description: `${activity.type === 'work_order' ? 'Work order' : 'Invoice'} #${activity.id} ${
        activity.description
          .replace(/_/g, ' ')  // Replace underscores with spaces
          .toLowerCase()        // Convert to lowercase
          .replace(/\b\w/g, l => l.toUpperCase())  // Capitalize first letter of each word
      }`,
      timestamp: activity.timestamp,
      link: {
        href: `/${activity.type === 'work_order' ? 'work-orders' : 'invoices'}/${activity.link_id}`,
        text: "View"
      }
    }));

    // Fetch today's schedule
    const todaysSchedule = await db.query(`
      SELECT 
        wo.id,
        wo.scheduled_start as time,
        c.company_name as client,
        wo.status,
        wo.description,
        u.first_name || ' ' || u.last_name as technician
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN users u ON wo.assigned_technician_id = u.id
      WHERE DATE(wo.scheduled_start) = CURRENT_DATE
      ORDER BY wo.scheduled_start
    `);
    console.log('Today\'s schedule count:', todaysSchedule.rows.length);

    return {
      stats: {
        workOrdersCount: parseInt(workOrdersStats.rows[0]?.total_count || 0),
        workOrdersPending: parseInt(workOrdersStats.rows[0]?.pending_count || 0),
        workOrdersTrend: 0, // Calculate trend if needed
        todaysJobsCount: parseInt(workOrdersStats.rows[0]?.today_count || 0),
        todaysJobsCompleted: parseInt(workOrdersStats.rows[0]?.today_completed || 0),
        pendingInvoicesCount: parseInt(invoiceStats.rows[0]?.pending_count || 0),
        pendingInvoicesValue: (invoiceStats.rows[0]?.pending_value || 0).toFixed(2),
        monthlyRevenue: (invoiceStats.rows[0]?.monthly_revenue || 0).toFixed(2),
        revenueTrend: 0 // Calculate trend if needed
      },
      recentActivity: formattedActivity,
      todaysSchedule: todaysSchedule.rows.map(schedule => ({
        id: schedule.id,
        time: new Date(schedule.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        client: schedule.client,
        description: schedule.description,
        status: schedule.status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        technician: schedule.technician
      }))
    };
  } catch (error) {
    console.error('Error in fetchDashboardStats:', error);
    throw error;
  }
}

// Temporarily remove withApiAuthRequired wrapper
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting dashboard stats fetch...');
    const data = await fetchDashboardStats();
    console.log('Dashboard stats fetch completed successfully');
    res.status(200).json(data);
  } catch (error) {
    console.error('Dashboard stats error:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}