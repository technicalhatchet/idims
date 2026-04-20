import Head from 'next/head';
import { getSession } from '@auth0/nextjs-auth0';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import TechnicianForm from '../../components/technicians/TechnicianForm';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import { useTheme } from '../../context/ThemeContext';
import { useTechnicianMutations } from '../../hooks/useTechnicians';
import { useEffect, useState } from 'react';

function NewTechnician() {
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });
  const { theme } = useTheme();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const mutations = useTechnicianMutations();
  
  // Handler for submitting the form
  const handleSubmit = async (technicianData) => {
    try {
      setSubmitting(true);
      console.log('Creating technician with data:', technicianData);
      const result = await mutations.create(technicianData);
      console.log('Technician created successfully:', result);
      
      // Redirect to the technician details page after successful creation
      router.push(`/technicians/${result.id}`);
    } catch (error) {
      console.error('Error creating technician:', error);
      setSubmitting(false);
      throw error; // Pass the error back to the form
    }
  };
  
  // Ensure dark mode applies correctly on page load
  useEffect(() => {
    // Apply the theme from context to the document
    if (theme?.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme?.mode]);

  return (
    <>
      <Head>
        <title>Add New Technician | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Technician</h1>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <TechnicianForm 
            isEdit={false} 
            onSubmit={handleSubmit} 
            isSubmitting={submitting} 
          />
        </div>
      </div>
    </>
  );
}

NewTechnician.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

// Server-side authentication and role check
export async function getServerSideProps(context) {
  // Check authentication
  const session = await getSession(context.req, context.res);
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }
  
  // Additional role-based check could be added here if needed
  // For now, we're using the client-side useAuthRedirect hook
  
  return {
    props: {},
  };
}

export default NewTechnician;