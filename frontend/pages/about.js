import Head from 'next/head';
import HomeLayout from '../components/layouts/HomeLayout';

export default function About() {
  return (
    <>
      <Head>
        <title>About Us | Service Business Management</title>
      </Head>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            About Us
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            We are dedicated to helping service businesses thrive in the digital age.
          </p>
        </div>
        
        <div className="mt-12 prose prose-lg dark:prose-invert mx-auto">
          <p>
            Our platform provides comprehensive tools and solutions for service businesses
            to manage their operations efficiently and effectively.
          </p>
          
          <h2>Our Mission</h2>
          <p>
            To empower service businesses with the tools they need to succeed in today's
            competitive market.
          </p>
          
          <h2>Our Vision</h2>
          <p>
            To be the leading platform for service business management, helping companies
            grow and scale their operations.
          </p>
        </div>
      </div>
    </>
  );
}

// Use the home layout
About.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
}; 