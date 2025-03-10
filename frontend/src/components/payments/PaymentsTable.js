import { format } from 'date-fns';
import Link from 'next/link';
import { FaEye, FaReceipt, FaUndo } from 'react-icons/fa';

export default function PaymentsTable({ payments, onRefund }) {
  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No payments found.
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Payment #
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Invoice #
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Method
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {payments.map((payment) => (
            <tr key={payment.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                <Link href={`/payments/${payment.id}`}>
                  {payment.payment_number}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {payment.invoice_number ? (
                  <Link href={`/invoices/${payment.invoice_id}`} className="text-blue-600 hover:text-blue-900">
                    {payment.invoice_number}
                  </Link>
                ) : (
                  'N/A'
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {payment.client_name ? (
                  <Link href={`/clients/${payment.client_id}`} className="text-blue-600 hover:text-blue-900">
                    {payment.client_name}
                  </Link>
                ) : (
                  'N/A'
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${payment.amount.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {format(new Date(payment.payment_date), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                {payment.payment_method.replace('_', ' ')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  payment.status === 'success' ? 'bg-green-100 text-green-800' : 
                  payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                  payment.status === 'failed' ? 'bg-red-100 text-red-800' : 
                  'bg-purple-100 text-purple-800'  // refunded
                }`}>
                  {payment.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link href={`/payments/${payment.id}`} className="text-blue-600 hover:text-blue-900 mr-3">
                  <FaEye className="inline mr-1" />
                  View
                </Link>
                {payment.status === 'success' && (
                  <button 
                    onClick={() => onRefund(payment)} 
                    className="text-red-600 hover:text-red-900 mr-3"
                  >
                    <FaUndo className="inline mr-1" />
                    Refund
                  </button>
                )}
                <button className="text-green-600 hover:text-green-900">
                  <FaReceipt className="inline mr-1" />
                  Receipt
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}