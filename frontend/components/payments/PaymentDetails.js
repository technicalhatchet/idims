import { format } from 'date-fns';
import Link from 'next/link';
import { FaRegCreditCard, FaMoneyBill, FaRegCheckCircle, FaExchangeAlt, FaPaypal, FaQuestionCircle } from 'react-icons/fa';

export default function PaymentDetails({ payment }) {
  if (!payment) {
    return (
      <div className="text-center py-4 text-gray-500">
        No payment data available.
      </div>
    );
  }
  
  // Payment method icon mapping
  const methodIcons = {
    credit_card: <FaRegCreditCard className="h-5 w-5 text-blue-500" />,
    cash: <FaMoneyBill className="h-5 w-5 text-green-500" />,
    check: <FaRegCheckCircle className="h-5 w-5 text-purple-500" />,
    bank_transfer: <FaExchangeAlt className="h-5 w-5 text-indigo-500" />,
    paypal: <FaPaypal className="h-5 w-5 text-blue-700" />,
    other: <FaQuestionCircle className="h-5 w-5 text-gray-500" />
  };
  
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-900">Payment Details</h2>
      </div>
      
      <div className="px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Payment Number</h3>
            <p className="mt-1 text-sm text-gray-900">{payment.payment_number}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Amount</h3>
            <p className="mt-1 text-xl font-semibold text-gray-900">${payment.amount.toFixed(2)}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <div className="mt-1">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                payment.status === 'success' ? 'bg-green-100 text-green-800' : 
                payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                payment.status === 'failed' ? 'bg-red-100 text-red-800' : 
                'bg-purple-100 text-purple-800'  // refunded
              }`}>
                {payment.status}
              </span>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Date</h3>
            <p className="mt-1 text-sm text-gray-900">
              {format(new Date(payment.payment_date), 'MMMM d, yyyy h:mm a')}
            </p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Payment Method</h3>
            <div className="mt-1 flex items-center text-sm text-gray-900">
              {methodIcons[payment.payment_method] || methodIcons.other}
              <span className="ml-2 capitalize">{payment.payment_method.replace('_', ' ')}</span>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Reference Number</h3>
            <p className="mt-1 text-sm text-gray-900">{payment.reference_number || 'N/A'}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Transaction ID</h3>
            <p className="mt-1 text-sm text-gray-900">{payment.transaction_id || 'N/A'}</p>
          </div>
          
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-gray-500">Notes</h3>
            <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">{payment.notes || 'No notes'}</p>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-5 border-t border-gray-200 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-900">Related Invoice</h2>
      </div>
      
      <div className="px-6 py-5">
        {payment.invoice_id ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Invoice Number</h3>
              <p className="mt-1 text-sm text-blue-600">
                <Link href={`/invoices/${payment.invoice_id}`}>
                  {payment.invoice_number}
                </Link>
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Client</h3>
              <p className="mt-1 text-sm text-blue-600">
                <Link href={`/clients/${payment.client_id}`}>
                  {payment.client_name}
                </Link>
              </p>
            </div>
            
            {payment.invoice && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Invoice Total</h3>
                  <p className="mt-1 text-sm text-gray-900">${payment.invoice.total.toFixed(2)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Remaining Balance</h3>
                  <p className="mt-1 text-sm text-gray-900">${payment.invoice.balance.toFixed(2)}</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-gray-500">No related invoice</p>
        )}
      </div>
    </div>
  );
}