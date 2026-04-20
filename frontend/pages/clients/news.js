import { useState, useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaArrowLeft, FaBell, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import { withPageAuthRequired } from '../../utils/auth0-helpers';

// For demo purposes, we'll use static news items
// In a real application, you would fetch this from an API
const newsItems = [
  {
    id: 1,
    title: 'New Service Offerings Now Available',
    date: new Date(2023, 2, 15),
    content: 'We are excited to announce our expanded service offerings including preventative maintenance contracts and remote diagnostics. Contact your account manager to learn more.',
    type: 'announcement',
    isImportant: true
  },
  {
    id: 2,
    title: 'System Maintenance Scheduled',
    date: new Date(2023, 3, 10),
    content: 'Our service portal will be undergoing scheduled maintenance on April 15th from 2:00 AM to 5:00 AM Eastern Time. During this period, some features may be temporarily unavailable.',
    type: 'maintenance',
    isImportant: false
  },
  {
    id: 3,
    title: 'Updated Client Portal Features',
    date: new Date(2023, 3, 5),
    content: 'We\'ve enhanced our client portal with new features including improved work order tracking, real-time technician location updates, and streamlined payment processing. Check out the updated dashboard!',
    type: 'update',
    isImportant: false
  },
  {
    id: 4,
    title: 'Holiday Service Schedule',
    date: new Date(2023, 3, 1),
    content: 'Please note our modified service hours during the upcoming holiday weekend. Emergency services will remain available 24/7 through our standard support channels.',
    type: 'announcement',
    isImportant: true
  },
  {
    id: 5,
    title: 'Introducing Our New Mobile App',
    date: new Date(2023, 2, 20),
    content: 'Download our new mobile application now available for iOS and Android devices. Request service, track work orders, and manage your account on the go!',
    type: 'update',
    isImportant: true
  }
];

function ClientNewsPage() {
  const [filteredNews, setFilteredNews] = useState(newsItems);
  const [selectedTypes, setSelectedTypes] = useState(['announcement', 'maintenance', 'update']);
  
  // Authorization check
  useAuthRedirect();
  
  // Filter news when selectedTypes changes
  useEffect(() => {
    setFilteredNews(
      newsItems.filter(item => selectedTypes.includes(item.type))
    );
  }, [selectedTypes]);
  
  const handleTypeToggle = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };
  
  const getTypeIcon = (type) => {
    switch (type) {
      case 'announcement':
        return <FaBell className="text-blue-500" />;
      case 'maintenance':
        return <FaExclamationTriangle className="text-orange-500" />;
      case 'update':
        return <FaInfoCircle className="text-green-500" />;
      default:
        return <FaInfoCircle className="text-gray-500" />;
    }
  };
  
  const getTypeColor = (type) => {
    switch (type) {
      case 'announcement':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'maintenance':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'update':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };
  
  return (
    <>
      <Head>
        <title>Client News & Updates | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex items-center mb-6">
          <Link href="/clients" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-4">
            <FaArrowLeft className="inline mr-2" />
            Back to Clients
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">News & Updates</h1>
        </div>
        
        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleTypeToggle('announcement')}
            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center
              ${selectedTypes.includes('announcement') 
                ? 'bg-blue-600 text-white dark:bg-blue-700' 
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
          >
            <FaBell className="mr-1" />
            Announcements
          </button>
          <button
            onClick={() => handleTypeToggle('maintenance')}
            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center
              ${selectedTypes.includes('maintenance') 
                ? 'bg-orange-600 text-white dark:bg-orange-700' 
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
          >
            <FaExclamationTriangle className="mr-1" />
            Maintenance
          </button>
          <button
            onClick={() => handleTypeToggle('update')}
            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center
              ${selectedTypes.includes('update') 
                ? 'bg-green-600 text-white dark:bg-green-700' 
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
          >
            <FaInfoCircle className="mr-1" />
            Updates
          </button>
        </div>
        
        {/* News items */}
        <div className="space-y-6">
          {filteredNews.length > 0 ? (
            filteredNews.map((item) => (
              <div 
                key={item.id} 
                className={`bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden 
                  ${item.isImportant ? 'border-l-4 border-red-500' : ''}`}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className="mr-3">
                        {getTypeIcon(item.type)}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {item.title}
                          {item.isImportant && (
                            <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded dark:bg-red-900 dark:text-red-200">
                              Important
                            </span>
                          )}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {format(item.date, 'MMMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(item.type)}`}>
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </span>
                  </div>
                  <div className="mt-4 text-gray-700 dark:text-gray-300">
                    <p>{item.content}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">No news items match your selected filters.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Use the dashboard layout
ClientNewsPage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(ClientNewsPage); 