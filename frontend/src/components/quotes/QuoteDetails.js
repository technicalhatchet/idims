import { format } from 'date-fns';
import StatusBadge from '@/components/ui/StatusBadge';

export default function QuoteDetails({ quote }) {
  if (!quote) {
    return (
      <div className="text-center py-4 text-gray-500">
        No quote data available.
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Quote Details</h2>
          <StatusBadge status={quote.status} />
        </div>
        
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Quote Number</h3>
              <p className="mt-1 text-sm text-gray-900">{quote.quote_number}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Client</h3>
              <p className="mt-1 text-sm text-gray-900">
                {quote.client?.company_name || `${quote.client?.first_name} ${quote.client?.last_name}`}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Title</h3>
              <p className="mt-1 text-sm text-gray-900">{quote.title}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Created Date</h3>
              <p className="mt-1 text-sm text-gray-900">
                {format(new Date(quote.created_at), 'MMMM d, yyyy')}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Valid Until</h3>
              <p className="mt-1 text-sm text-gray-900">
                {format(new Date(quote.valid_until), 'MMMM d, yyyy')}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total</h3>
              <p className="mt-1 text-xl font-semibold text-gray-900">${quote.total.toFixed(2)}</p>
            </div>
          </div>
          
          {quote.description && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500">Description</h3>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">{quote.description}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Quote Items</h2>
        </div>
        
        <div className="px-6 py-5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax Rate
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${item.unit_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.tax_rate > 0 ? `${item.tax_rate}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.discount > 0 ? `${item.discount}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    Subtotal:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${quote.subtotal.toFixed(2)}
                  </td>
                </tr>
                {quote.tax > 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      Tax:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${quote.tax.toFixed(2)}
                    </td>
                  </tr>
                )}
                {quote.discount > 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      Discount:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      -${quote.discount.toFixed(2)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-right text-base font-bold text-gray-900">
                    Total:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-gray-900">
                    ${quote.total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
      
      {(quote.terms || quote.notes) && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Additional Information</h2>
          </div>
          
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quote.terms && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Terms & Conditions</h3>
                  <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">{quote.terms}</p>
                </div>
              )}
              
              {quote.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Notes</h3>
                  <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">{quote.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}