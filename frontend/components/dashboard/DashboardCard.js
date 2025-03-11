import Link from 'next/link';
import { FaArrowUp, FaArrowDown } from 'react-icons/fa';

export default function DashboardCard({ 
  title, 
  value, 
  subtitle = null, 
  icon, 
  color = 'blue', 
  trend = null, 
  link = null,
  isLoading = false
}) {
  // Colors based on theme
  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800'
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800'
    },
    indigo: {
      bg: 'bg-indigo-100 dark:bg-indigo-900',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-200 dark:border-indigo-800'
    },
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-800'
    },
    red: {
      bg: 'bg-red-100 dark:bg-red-900',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800'
    },
    gray: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700'
    }
  };
  
  // Get color classes
  const { bg, text, border } = colorClasses[color] || colorClasses.blue;
  
  // Render trend indicator if provided
  const renderTrend = () => {
    if (trend === null) return null;
    
    const isPositive = trend >= 0;
    const absValue = Math.abs(trend);
    
    return (
      <div className={`flex items-center ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {isPositive ? (
          <FaArrowUp className="mr-1 h-3 w-3" />
        ) : (
          <FaArrowDown className="mr-1 h-3 w-3" />
        )}
        <span className="text-sm font-medium">{absValue}%</span>
      </div>
    );
  };
  
  // Render card content
  const renderContent = () => {
    return (
      <>
        <div className={`p-3 rounded-full ${bg} ${text}`}>
          {icon}
        </div>
        <div className="ml-5 w-0 flex-1">
          <div className="flex items-center justify-between">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
              {title}
            </dt>
            {renderTrend()}
          </div>
          <dd>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {isLoading ? (
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              ) : (
                value
              )}
            </div>
            {subtitle && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {isLoading ? (
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></div>
                ) : (
                  subtitle
                )}
              </div>
            )}
          </dd>
        </div>
      </>
    );
  };
  
  // Card wrapper
  if (link) {
    return (
      <Link 
        href={link} 
        className={`px-4 py-5 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border ${border} hover:shadow-md transition-shadow`}
      >
        <div className="flex items-center">
          {renderContent()}
        </div>
      </Link>
    );
  }
  
  return (
    <div className={`px-4 py-5 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border ${border}`}>
      <div className="flex items-center">
        {renderContent()}
      </div>
    </div>
  );
}