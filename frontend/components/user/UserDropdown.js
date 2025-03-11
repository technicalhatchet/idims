import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FaUserCircle, FaCog, FaSignOutAlt, FaChevronDown } from 'react-icons/fa';

export default function UserDropdown({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Get user role from Auth0 metadata
  const userRole = user['https://servicebusiness.com/roles']?.[0] || 'client';
  
  // Format role for display (capitalize first letter)
  const formattedRole = userRole.charAt(0).toUpperCase() + userRole.slice(1);
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center space-x-2 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name || 'User profile'}
              className="w-full h-full object-cover"
            />
          ) : (
            <FaUserCircle className="w-full h-full text-gray-500 dark:text-gray-400" />
          )}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200">{user.name}</span>
        <FaChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Role: {formattedRole}
            </div>
          </div>
          
          <Link href="/settings/profile" className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
            <FaUserCircle className="mr-3 text-gray-500 dark:text-gray-400" />
            Profile
          </Link>
          
          <Link href="/settings" className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
            <FaCog className="mr-3 text-gray-500 dark:text-gray-400" />
            Settings
          </Link>
          
          <hr className="border-t border-gray-200 dark:border-gray-700 my-1" />
          
          <Link href="/api/auth/logout" className="flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <FaSignOutAlt className="mr-3" />
            Sign out
          </Link>
        </div>
      )}
    </div>
  );
}