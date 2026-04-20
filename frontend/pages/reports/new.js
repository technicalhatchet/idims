import { useState } from 'react';
import { withPageAuthRequired } from '../../utils/auth0-helpers';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import ReportForm from '../../components/reports/ReportForm';
import ErrorAlert from '../../components/ui/ErrorAlert';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';

// Simple implementation of the report generation hook
const useGenerateCustomReport = () => {
  return useMutation({
    mutationFn: async (reportConfig) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        id: 'report-' + Math.random().toString(36).substring(2, 9),
        type: reportConfig.reportType || 'custom'
      };
    }
  });
};

function NewReport() {
  const [error, setError] = useState(null);
  const router = useRouter();
  
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
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Generate Report</h1>
          <Link href="/reports" className="btn-outline">
            Back to Reports
          </Link>
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

export default withPageAuthRequired(NewReport);