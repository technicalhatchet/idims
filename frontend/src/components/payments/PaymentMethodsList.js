import { FaRegCreditCard, FaMoneyBill, FaCcPaypal, FaUniversity, FaTrash, FaStar, FaRegStar } from 'react-icons/fa';

export default function PaymentMethodsList({ paymentMethods, onDelete, onSetDefault }) {
  if (!paymentMethods || paymentMethods.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No payment methods found.
      </div>
    );
  }
  
  // Payment method icon mapping
  const typeIcons = {
    credit_card: <FaRegCreditCard className="h-5 w-5 text-blue-500" />,
    bank_account: <FaUniversity className="h-5 w-5 text-green-500" />,
    paypal: <FaCcPaypal className="h-5 w-5 text-blue-700" />,
    other: <FaMoneyBill className="h-5 w-5 text-gray-500" />
  };
  
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {paymentMethods.map((method) => (
          <li key={method.id}>
            <div className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center">
                {typeIcons[method.type] || typeIcons.other}
                <div className="ml-4">
                  <div className="flex items-center">
                    <p className="font-medium text-gray-900">{method.display_name}</p>
                    {method.is_default && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {method.type === 'credit_card' && (
                      <p>
                        {method.last_four && `•••• •••• •••• ${method.last_four}`}
                        {method.expiry_date && ` - Expires ${method.expiry_date}`}
                      </p>
                    )}
                    {method.type === 'bank_account' && (
                      <p>
                        {method.last_four && `Account ending in ${method.last_four}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {!method.is_default && (
                  <button
                    onClick={() => onSetDefault(method)}
                    className="p-2 text-yellow-600 hover:text-yellow-800"
                    aria-label="Set as default"
                  >
                    <FaRegStar />
                  </button>
                )}
                <button
                  onClick={() => onDelete(method)}
                  className="p-2 text-red-600 hover:text-red-800"
                  aria-label="Delete payment method"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}