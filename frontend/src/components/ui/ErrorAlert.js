import { FaExclamationCircle } from 'react-icons/fa';

export default function ErrorAlert({ message, onRetry }) {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 my-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <FaExclamationCircle className="text-red-500 text-lg" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-red-700">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}