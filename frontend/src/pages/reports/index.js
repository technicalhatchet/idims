import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import { FaFilter, FaPlus, FaCalendarAlt } from 'react-icons/fa';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import Pagination from '@/components/ui/Pagination';
import ReportsTable from '@/components/reports/ReportsTable';
import ReportFilters from '@/components/reports/ReportFilters';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useSavedReports, useDownloadReport } from '@/hooks/useReports';
import { useRouter } from 'next/router';

function Reports() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const router = useRouter();
  const limit = 10;
  
  // Fetch saved reports
  const { 
    data: reportsData, 
    isLoading,
    error,
    refetch
  } = useSavedReports(filters.reportType, {
    keepPreviousData: true
  });
  
  // Download report mutation
  const downloadMutation = useDownloadReport();
  
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };
  
  const handleFilterToggle = () => {
    setIsFilterOpen(!isFilterOpen);
  };
  
  const handleViewReport = (report) => {
    router.push(`/reports/${report.type}/${report.id}`);
  };
  
  const handleDownloadReport = (report) => {
    setSelectedReport(report);
    setShowDownloadModal(true);
  };
  
  const handleDownloadConfirm = async () => {
    if (!selectedReport) return;
    
    try {
      await downloadMutation.mutateAsync({
        reportId: selectedReport.id,
        format: downloadFormat
      });
      setShowDownloadModal(false);
    } catch (error) {
      console.error('Download error', error);
    }
  };
  
  // Paginate reports data
  const paginatedReports = reportsData?.items || [];
  const totalReports = reportsData?.total || 0;
  
  return (
    <>
      <Head>
        <title>Reports | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-2xl font-bold mb-4 sm:mb-0">Reports</h1>
          <div className="flex space-x-2">
            <button
              onClick={handleFilterToggle}
              className="btn-outline flex items-center"
              aria-label="Filter reports"
            >
              <FaFilter className="mr-2" />
              Filters
            </button>
            <Button
              variant="outline"
              onClick={() => router.push('/reports/schedules')}
              className="flex items-center"
            >
              <FaCalendarAlt className="mr-2" />
              Scheduled Reports
            </Button>
            <Button
              variant="primary"
              onClick={() => router.push('/reports/new')}
              className="flex items-center"
            >
              <FaPlus className="mr-2" />
              Generate Report
            </Button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert 
            message="Failed to load reports" 
            onRetry={refetch}
          />
        ) : (
          <>
            <ReportsTable 
              reports={paginatedReports} 
              onView={handleViewReport}
              onDownload={handleDownloadReport}
            />
            
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(totalReports / limit)}
                onPageChange={setPage}
              />
            </div>
          </>
        )}

        <ReportFilters
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          filters={filters}
          onFilterChange={handleFilterChange}
        />
        
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

Reports.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default Reports;