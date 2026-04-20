import React from 'react';

/**
 * Tabs component for navigation between different sections
 * 
 * @param {Object} props
 * @param {Array} props.tabs - Array of tab objects with {id, label, icon} properties
 * @param {string} props.activeTab - ID of the currently active tab
 * @param {Function} props.onChange - Function called when tab is changed, receives tab ID
 * @param {string} [props.className] - Additional CSS classes
 */
export default function Tabs({ tabs, activeTab, onChange, className = '' }) {
  if (!tabs || tabs.length === 0) return null;
  
  return (
    <div className={`border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <nav className="-mb-px flex space-x-8 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                ${isActive 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500'}
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
} 