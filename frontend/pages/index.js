import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import HomeLayout from '../components/layouts/HomeLayout';
import { FaChartLine, FaCalendarAlt, FaFileInvoiceDollar, FaMobileAlt, FaUsers, FaChartBar } from 'react-icons/fa';

export default function Home() {
  const { user } = useUser();

  return (
    <>
      <Head>
        <title>Service Business Management | Home</title>
      </Head>

      {/* Hero Section */}
      <section className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-8 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Streamline Your Service Business Operations
            </h1>
            <p className="mt-4 text-xl text-blue-100">
              All-in-one platform for managing work orders, invoices, scheduling, and customer relationships.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              {user ? (
                <Link href="/dashboard" className="px-6 py-3 bg-white text-blue-600 font-medium rounded-md shadow hover:bg-gray-100 transition-colors">
                  Go to Dashboard
                </Link>
              ) : (
                <Link href="/api/auth/login" className="px-6 py-3 bg-white text-blue-600 font-medium rounded-md shadow hover:bg-gray-100 transition-colors">
                  Get Started
                </Link>
              )}
              <Link href="/about" className="px-6 py-3 border border-white text-white font-medium rounded-md hover:bg-blue-700 transition-colors">
                Learn More
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 flex justify-center">
            <div className="rounded-lg shadow-xl w-full max-w-md bg-white p-4">
              <div className="h-64 flex items-center justify-center bg-gray-100 rounded">
                <span className="text-gray-400">Dashboard Preview</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Everything You Need to Run Your Service Business
            </h2>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
              Our comprehensive platform helps you manage every aspect of your service business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <FaChartLine className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Work Order Management
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Create, track, and manage work orders from creation to completion. Assign technicians and track progress in real-time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <FaCalendarAlt className="text-green-600 dark:text-green-400 text-xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Smart Scheduling
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Efficiently schedule jobs with our intuitive calendar interface. Prevent conflicts and optimize technician routes.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mb-4">
                <FaFileInvoiceDollar className="text-indigo-600 dark:text-indigo-400 text-xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Invoicing & Payments
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Generate professional invoices automatically from work orders. Accept online payments and track payment status.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-12 md:py-20 bg-blue-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to Transform Your Service Business?
          </h2>
          <p className="mt-4 text-xl text-blue-100">
            Join thousands of service businesses using our platform to streamline operations and increase profitability.
          </p>
          <div className="mt-8">
            <Link href="/api/auth/login" className="px-8 py-4 bg-white text-blue-600 font-medium rounded-md text-lg shadow hover:bg-gray-100 transition-colors">
              Start Your Free Trial
            </Link>
          </div>
          <p className="mt-4 text-blue-200 text-sm">
            No credit card required. 14-day free trial.
          </p>
        </div>
      </section>
    </>
  );
}

// Use the home layout for this page
Home.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
};