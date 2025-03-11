export default function StatusBadge({ status, size = "medium" }) {
  const getStatusConfig = () => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' };
      case 'scheduled':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Scheduled' };
      case 'in_progress':
      case 'in progress':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'In Progress' };
      case 'on_hold':
      case 'on hold':
        return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'On Hold' };
      case 'completed':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' };
      case 'cancelled':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' };
      case 'paid':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' };
      case 'partially_paid':
      case 'partially paid':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Partially Paid' };
      case 'overdue':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Overdue' };
      case 'draft':
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' };
      case 'sent':
        return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Sent' };
      case 'accepted':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted' };
      case 'rejected':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' };
      case 'active':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' };
      case 'inactive':
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactive' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: status || 'Unknown' };
    }
  };
  
  const config = getStatusConfig();
  const sizeClasses = size === "small" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  
  return (
    <span className={`inline-flex items-center ${sizeClasses} font-medium rounded-full ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}