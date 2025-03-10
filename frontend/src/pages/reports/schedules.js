import { useState } from 'react';
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { FaPlus } from 'react-icons/fa';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import ScheduledReportsList from '@/components/reports/ScheduledReportsList';
import ScheduleReportForm from '@/components/reports/ScheduleReportForm';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { 
  useScheduledReports, 
  useScheduleReport, 
  useUpdateScheduledReport, 
  useDeleteScheduledReport 
} from '@/hooks/useReports';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

function ScheduledReports() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const router = useRouter();
  
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });
  
  // Fetch scheduled reports
  const { 
    data: reports, 
    isLoading,
    error,
    refetch
  } = useScheduledReports();
  
  // Mutations
  const scheduleMutation = useScheduleReport();
  const updateMutation = useUpdateScheduledReport();
  const deleteMutation = useDeleteScheduledReport();
  
  const handleCreateSchedule = async (scheduleConfig) => {
    try {
      await scheduleMutation.mutateAsync(scheduleConfig);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating schedule:', error);
    }
  };
  
  const handleEditSchedule = (report) => {
    setCurrentReport(report);
    setShowEditModal(true);
  };
  
  const handleUpdateSchedule = async (scheduleConfig) => {
    if (!currentReport) return;
    
    try {
      await updateMutation.mutateAsync({
        scheduleId: currentReport.id,
        scheduleConfig
      });
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };
  
  const handleDeleteClick = (report) => {
    setCurrentReport(report);
    setShowDeleteModal(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!currentReport) return;
    
    try {
      await deleteMutation.mutateAsync(currentReport.id);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };
  
  const handleToggleActive = async (report) => {
    try {
      await updateMutation.mutateAsync({
        scheduleId: report.id,
        scheduleConfig: {
          ...report,
          isActive: !report.isActive
        }
      });
    } catch (error) {
      console.error('Error toggling active state:', error);
    }
  };
  
  return (
    <>
      <Head>
        <title>Scheduled Reports | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-2xl font-bold mb-4 sm:mb-0">Scheduled Reports</h1>
          <div className="flex space-x-2">
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center"
            >
              <FaPlus className="mr-2" />
              New Schedule
            </Button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert 
            message="Failed to load scheduled reports" 
            onRetry={refetch}
          />
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <ScheduledReportsList 
              reports={reports || []} 
              onEdit={handleEditSchedule}
              onDelete={handleDeleteClick}
              onToggleActive={handleToggleActive}
            />
          </div>
        )}
        
        {/* Create Schedule Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create Scheduled Report"
          size="lg"
        >
          <ScheduleReportForm
            onSubmit={handleCreateSchedule}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
        
        {/* Edit Schedule Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Scheduled Report"
          size="lg"
        >
          <ScheduleReportForm
            initialData={currentReport}
            onSubmit={handleUpdateSchedule}
            onCancel={() => setShowEditModal(false)}
          />
        </Modal>
        
        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Scheduled Report"
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="mr-3"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                isLoading={deleteMutation.isLoading}
                disabled={deleteMutation.isLoading}
              >
                Delete
              </Button>
            </>
          }
        >
          <p>Are you sure you want to delete this scheduled report?</p>
          {currentReport && (
            <p className="font-medium mt-2">{currentReport.name}</p>
          )}
          <p className="text-red-600 mt-4">This action cannot be undone.</p>
        </Modal>
      </div>
    </>
  );
}

ScheduledReports.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = withPageAuthRequired();

export default ScheduledReports;