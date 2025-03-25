import { format } from 'date-fns';
import Link from 'next/link';
import { FaEye, FaUndo } from 'react-icons/fa';
import StatusBadge from '../ui/StatusBadge';

export default function PaymentsTable({ payments = [], onRefund }) {
  if (!payments.length) {
    return (
      <div className="bg-white shadow overflow-hidden rounded-lg py-10 text-center border">
        <p className="text-gray-500">No payments found</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment #
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => {
              // Format payment date
              const formattedDate = payment.date 
                ? format(new Date(payment.date), 'MMM d, yyyy')
                : 'N/A';
              
              // Determine client name display
              const clientName = payment.client
                ? (payment.client.company_name || `${payment.client.first_name} ${payment.client.last_name}`)
                : 'N/A';
              
              // Format payment method display
              const paymentMethod = payment.payment_method
                ? payment.payment_method.replace(/_/g, ' ')
                : 'N/A';
                
              return (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/payments/${payment.id}`} className="text-blue-600 hover:text-blue-900">
                      {payment.payment_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formattedDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.client_id ? (
                      <Link href={`/clients/${payment.client_id}`} className="text-blue-600 hover:text-blue-900">
                        {clientName}
                      </Link>
                    ) : (
                      clientName
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${payment.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {paymentMethod}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={payment.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Link
                        href={`/payments/${payment.id}`}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="View payment details"
                      >
                        <FaEye />
                      </Link>
                      
                      {/* Only show refund option for successful payments */}
                      {payment.status === 'success' && !payment.refunded && (
                        <button
                          onClick={() => onRefund && onRefund(payment)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Process refund"
                        >
                          <FaUndo />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}