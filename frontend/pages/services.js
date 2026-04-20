import Head from 'next/head';
import HomeLayout from '../components/layouts/HomeLayout';

export default function Services() {
  return (
    <>
      <Head>
        <title>Our Services | Service Business Management</title>
      </Head>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Our Services
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Comprehensive solutions for service businesses
          </p>
        </div>
        
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Service 1 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Work Order Management
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Streamline your work order process with our intuitive management system.
            </p>
          </div>
          
          {/* Service 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Customer Management
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Keep track of customer information and service history in one place.
            </p>
          </div>
          
          {/* Service 3 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Scheduling & Dispatch
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Efficiently manage your team's schedule and dispatch work orders.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Use the home layout
Services.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
}; 