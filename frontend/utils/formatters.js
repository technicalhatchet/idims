/**
 * Format currency value
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format date value
 * @param {string|Date} date - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  if (!date) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(new Date(date));
}

/**
 * Format phone number to (XXX) XXX-XXXX
 * @param {string} phone - The phone number to format
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format to (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  
  // If not valid 10-digit number, return original
  return phone;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length before truncating
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format number with commas for thousands
 * @param {number} num - The number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format percentage value
 * @param {number} value - The value to format as percentage
 * @param {number} decimalPlaces - Number of decimal places
 * @returns {string} Formatted percentage
 */
export function formatPercentage(value, decimalPlaces = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  }).format(value / 100);
} 