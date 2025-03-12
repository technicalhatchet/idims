import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import ReportViewer from '@/components/reports/ReportViewer';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useSavedReport, useDownloadReport } from '../../hooks/useReports';

function ReportDetails() {
  const router = useRouter();
  const { type, id } = router.query;
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  
  // Fetch report data
  const { 
    data: report, 
    isLoading,
    error,
    refetch
  } = useSavedReport(
    type,
    id,
    'summary.json', // Default file to load
    {
      enabled: !!type && !!id
    }
  );
  
  // Download report mutation
  const downloadMutation = useDownloadReport();
  
  const handleDownload = () => {
    setShowDownloadModal(true);
  };
  
  const handleDownloadConfirm = async () => {
    try {
      await downloadMutation.mutateAsync({
        reportId: id,
        format: downloadFormat
      });
      setShowDownloadModal(false);
    } catch (error) {
      console.error('Download error', error);
    }
  };
  
  return (
    <>
      <Head>
        <title>{report?.title || 'Report Details'} | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6">
          <button
            onClick={() => router.push('/reports')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Reports
          </button>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert 
            message="Failed to load report details" 
            onRetry={refetch}
          />
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <ReportViewer 
              report={report} 
              onDownload={handleDownload}
            />
          </div>
        )}
        
        {/* Download Modal */}
        <Modal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          title="Download Report"
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => setShowDownloadModal(false)}
                className="mr-3"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDownloadConfirm}
                isLoading={downloadMutation.isLoading}
                disabled={downloadMutation.isLoading}
              >
                Download
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p>Select format for download:</p>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="downloadFormat"
                  value="pdf"
                  checked={downloadFormat === 'pdf'}
                  onChange={() => setDownloadFormat('pdf')}
                />
                <span className="ml-2">PDF</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="downloadFormat"
                  value="csv"
                  checked={downloadFormat === 'csv'}
                  onChange={() => setDownloadFormat('csv')}
                />
                <span className="ml-2">CSV</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="downloadFormat"
                  value="json"
                  checked={downloadFormat === 'json'}
                  onChange={() => setDownloadFormat('json')}
                />
                <span className="ml-2">JSON</span>
              </label>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}

ReportDetails.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(ctx) {
    return {
      props: {}
    };
  }
});

export default ReportDetails;