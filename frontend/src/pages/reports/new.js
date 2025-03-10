import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import ReportForm from '@/components/reports/ReportForm';
import ErrorAlert from '@/components/ui/ErrorAlert';
import { useGenerateCustomReport } from '@/hooks/useReports';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

function NewReport() {
  const [error, setError] = useState(null);
  const router = useRouter();
  
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });
  
  // Generate report mutation
  const generateMutation = useGenerateCustomReport();
  
  const handleSubmit = async (reportConfig) => {
    try {
      setError(null);
      const result = await generateMutation.mutateAsync(reportConfig);
      
      // Navigate to the generated report
      if (result && result.id) {
        router.push(`/reports/${result.type}/${result.id}`);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report. Please try again.');
    }
  };
  
  return (
    <>
      <Head>
        <title>Generate Report | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Generate Report</h1>
        </div>

        {error && (
          <ErrorAlert 
            message={error} 
            onRetry={() => setError(null)}
          />
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <ReportForm 
            onSubmit={handleSubmit} 
            isGenerating={generateMutation.isLoading}
          />
        </div>
      </div>
    </>
  );
}

NewReport.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default NewReport;