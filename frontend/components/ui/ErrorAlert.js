import { FaExclamationCircle } from 'react-icons/fa';

export default function ErrorAlert({ message, onRetry }) {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 my-4 dark:bg-red-900/20 dark:border-red-700">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <FaExclamationCircle className="text-red-500 dark:text-red-400 text-lg" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-red-700 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}