import React, { forwardRef } from 'react';

// Text input component
export const TextInput = forwardRef(({ 
  label, 
  error, 
  id, 
  type = 'text', 
  className = '',
  required = false,
  helpText,
  ...props 
}, ref) => {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="mt-1">
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`form-input w-full rounded-md shadow-sm ${
            error ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-700 dark:focus:border-red-600 dark:focus:ring-red-600' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-600 dark:bg-gray-700 dark:text-white'
          }`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-description` : undefined}
          required={required}
          {...props}
        />
      </div>
      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400" id={`${inputId}-description`}>
          {helpText}
        </p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-500" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

TextInput.displayName = 'TextInput';

// Select component
export const SelectInput = forwardRef(({ 
  label, 
  error, 
  id, 
  className = '',
  required = false,
  helpText,
  options = [],
  emptyOption = null,
  isLoading = false,
  loadingError = null,
  value,
  ...props 
}, ref) => {
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  
  // Create a copy of options to avoid mutating the original array
  const displayOptions = [...options];
  
  // Always include empty option at the beginning if provided
  if (emptyOption) {
    // Make sure we don't add duplicate empty options if already present
    if (!displayOptions.some(opt => opt.value === '')) {
      displayOptions.unshift({ value: '', label: emptyOption });
    }
  }

  // Ensure value is a string
  const normalizedValue = value === undefined || value === null ? '' : String(value);
  
  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={selectId} 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative mt-1">
        <select
          ref={ref}
          id={selectId}
          className={`form-select w-full rounded-md shadow-sm ${
            error ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-700 dark:focus:border-red-600 dark:focus:ring-red-600' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-600 dark:bg-gray-700 dark:text-white'
          }`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : helpText ? `${selectId}-description` : undefined}
          required={required}
          disabled={isLoading}
          value={normalizedValue}
          {...props}
        >
          {displayOptions.map((option) => (
            <option key={option.value} value={option.value} className="dark:bg-gray-700 dark:text-white">
              {option.label}
            </option>
          ))}
        </select>
        {isLoading && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>
      {helpText && !error && !loadingError && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400" id={`${selectId}-description`}>
          {helpText}
        </p>
      )}
      {loadingError && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-500" id={`${selectId}-error-loading`} role="alert">
          {loadingError}
        </p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-500" id={`${selectId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

SelectInput.displayName = 'SelectInput';

// Textarea component
export const TextareaInput = forwardRef(({ 
  label, 
  error, 
  id, 
  className = '',
  required = false,
  helpText,
  rows = 3,
  ...props 
}, ref) => {
  const textareaId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={textareaId} 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="mt-1">
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`form-textarea w-full rounded-md shadow-sm ${
            error ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-700 dark:focus:border-red-600 dark:focus:ring-red-600' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-600 dark:bg-gray-700 dark:text-white'
          }`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : helpText ? `${textareaId}-description` : undefined}
          required={required}
          {...props}
        />
      </div>
      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400" id={`${textareaId}-description`}>
          {helpText}
        </p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-500" id={`${textareaId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

TextareaInput.displayName = 'TextareaInput';

// Checkbox component
export const Checkbox = forwardRef(({
  label,
  error,
  id,
  className = '',
  helpText,
  ...props
}, ref) => {
  const checkboxId = id || `checkbox-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <div className={`flex items-start ${className}`}>
      <div className="flex items-center h-5">
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className={`form-checkbox h-4 w-4 rounded ${
            error ? 'border-red-300 text-red-600 focus:ring-red-500' : 'border-gray-300 text-blue-600 focus:ring-blue-500'
          }`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${checkboxId}-error` : helpText ? `${checkboxId}-description` : undefined}
          {...props}
        />
      </div>
      <div className="ml-3 text-sm">
        {label && (
          <label htmlFor={checkboxId} className="font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        {helpText && !error && (
          <p className="text-gray-500 dark:text-gray-400" id={`${checkboxId}-description`}>
            {helpText}
          </p>
        )}
        {error && (
          <p className="text-red-600 dark:text-red-500" id={`${checkboxId}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

// Button component
export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  type = 'button',
  className = '',
  isLoading = false,
  icon = null,
  disabled = false,
  ...props
}) {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors";
  
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800",
    secondary: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 dark:bg-gray-700 dark:hover:bg-gray-800",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 dark:bg-green-700 dark:hover:bg-green-800",
    warning: "bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500 dark:bg-yellow-700 dark:hover:bg-yellow-800",
    outline: "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500 dark:border-gray-600 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600",
  };
  
  const sizeClasses = {
    small: "px-2.5 py-1.5 text-xs",
    medium: "px-4 py-2 text-sm",
    large: "px-6 py-3 text-base",
  };
  
  const disabledClasses = disabled || isLoading ? "opacity-50 cursor-not-allowed" : "";
  
  return (
    <button
      type={type}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabledClasses}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!isLoading && icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}

export const Input = ({ label, error, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
    )}
    <input
      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
      }`}
      {...props}
    />
    {error && (
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
    )}
  </div>
);

export const Select = ({ label, error, children, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
    )}
    <select
      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
      }`}
      {...props}
    >
      {children}
    </select>
    {error && (
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
    )}
  </div>
);

export const TextArea = ({ label, error, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
    )}
    <textarea
      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
      }`}
      {...props}
    />
    {error && (
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
    )}
  </div>
);

export function CheckboxInput({ label, checked, onChange, disabled = false, className = '', id = Math.random().toString(36).substring(7) }) {
  return (
    <div className={`flex items-center ${className}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
      />
      <label htmlFor={id} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
        {label}
      </label>
    </div>
  );
}