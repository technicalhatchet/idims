import React from 'react';
import { FaSpinner } from 'react-icons/fa';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  Icon,
  ...props
}) {
  // Base classes
  const baseClasses = 'inline-flex items-center justify-center border font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  // Size classes
  const sizeClasses = {
    xs: 'px-2.5 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm leading-4',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-2 text-base',
    xl: 'px-6 py-3 text-base',
  };
  
  // Variant classes
  const variantClasses = {
    primary: 'border-transparent text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-400',
    secondary: 'border-transparent text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500 disabled:bg-blue-50 disabled:text-blue-400',
    outline: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-blue-500',
    danger: 'border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400',
    warning: 'border-transparent text-white bg-orange-600 hover:bg-orange-700 focus:ring-orange-500 disabled:bg-orange-400',
    success: 'border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500 disabled:bg-green-400',
    white: 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-blue-500',
  };
  
  // Full width class
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${className} ${disabled || isLoading ? 'cursor-not-allowed opacity-75' : ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <FaSpinner className="mr-2 animate-spin" />
      )}
      {!isLoading && Icon && (
        <Icon className="mr-2 shrink-0" aria-hidden />
      )}
      {children}
    </button>
  );
}