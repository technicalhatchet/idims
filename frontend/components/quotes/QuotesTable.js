import { format } from 'date-fns';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { FaEye, FaEdit, FaExchangeAlt } from 'react-icons/fa';

export default function QuotesTable({ quotes }) {
  if (!quotes || quotes.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No quotes found.
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Quote #
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Valid Until
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
          {quotes.map((quote) => (
            <tr key={quote.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                <Link href={`/quotes/${quote.id}`}>
                  {quote.quote_number}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {quote.client?.company_name || `${quote.client?.first_name} ${quote.client?.last_name}`}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {quote.title}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${quote.total.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {format(new Date(quote.created_at), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {format(new Date(quote.valid_until), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={quote.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link href={`/quotes/${quote.id}`} className="text-blue-600 hover:text-blue-900 mr-3">
                  <FaEye className="inline mr-1" />
                  View
                </Link>
                <Link href={`/quotes/${quote.id}/edit`} className="text-indigo-600 hover:text-indigo-900 mr-3">
                  <FaEdit className="inline mr-1" />
                  Edit
                </Link>
                <Link href={`/quotes/${quote.id}/convert`} className="text-green-600 hover:text-green-900">
                  <FaExchangeAlt className="inline mr-1" />
                  Convert
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}