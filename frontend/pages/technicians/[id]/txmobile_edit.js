import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import TechnicianMobileShell, { TX_MOBILE_PAGE_BG } from '../../../components/technicians/TechnicianMobileShell';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useTechnician, useTechnicianMutations } from '../../../hooks/useTechnicians';

function TechnicianMobileEdit() {
  const router = useRouter();
  const { id } = router.query;
  const { data: technician, isLoading, error } = useTechnician(id);
  const { update, delete: deleteTechnician } = useTechnicianMutations();

  const [formData, setFormData] = useState({
    employee_id: '',
    status: 'active',
    hire_date: '',
    specialization: '',
  });
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (technician) {
      setFormData({
        employee_id: technician.employee_id || '',
        status: technician.status || 'active',
        hire_date: technician.hire_date ? technician.hire_date.split('T')[0] : '',
        specialization: technician.specialization || '',
      });
    }
  }, [technician]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await update({ id, data: formData });
      setUpdateSuccess(true);
      setTimeout(() => router.push(`/technicians/${id}/txmobile_view`), 1500);
    } catch (err) {
      setSubmitError(err.message || 'Failed to update technician');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTechnician(id);
      router.push('/techboard/operatives');
    } catch (err) {
      setSubmitError(err.message || 'Failed to delete technician');
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: TX_MOBILE_PAGE_BG }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !technician) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: TX_MOBILE_PAGE_BG }}>
        <button type="button" onClick={() => router.push('/techboard/operatives')} className="text-cyan-400">
          Back to Operatives
        </button>
      </div>
    );
  }

  const displayName = technician.user
    ? `${technician.user.first_name} ${technician.user.last_name}`
    : technician.employee_id;

  const inputClass = 'w-full px-3 py-2 text-sm rounded border text-white bg-[rgba(0,0,0,0.3)] border-cyan-400/30';

  return (
    <TechnicianMobileShell
      title={`Edit ${displayName} | Field Tech Dashboard`}
      scanKey="tx-edit"
      syncKey={id}
      titleplate={
        <div className="flex items-center gap-3">
          <Link href={`/technicians/${id}/txmobile_view`} className="text-cyan-400" data-hud-card>
            <FaArrowLeft size={18} />
          </Link>
          <h1 className="tx-edit-hud-orbitron text-base font-black uppercase tracking-[0.08em] text-white">Edit Operative</h1>
        </div>
      }
    >
      {updateSuccess && (
        <div className="rounded-lg p-4 mb-4 text-cyan-400 border border-cyan-400/30 bg-cyan-400/10" data-hud-card>
          Operative updated successfully! Redirecting...
        </div>
      )}
      {submitError && (
        <div className="rounded-lg p-4 mb-4 text-red-400 border border-red-400/30 bg-red-400/10" data-hud-card>
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="rounded-lg p-4 mb-4 border border-cyan-400/30 bg-[rgba(13,21,37,0.85)]" data-hud-card>
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide mb-4">Operative Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Employee ID *</label>
              <input type="text" name="employee_id" value={formData.employee_id} onChange={handleInputChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Status *</label>
              <select name="status" value={formData.status} onChange={handleInputChange} required className={inputClass}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Hire Date</label>
              <input type="date" name="hire_date" value={formData.hire_date} onChange={handleInputChange} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Specialization</label>
              <input type="text" name="specialization" value={formData.specialization} onChange={handleInputChange} className={inputClass} placeholder="e.g. HVAC, Electrical" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide text-cyan-400 border border-cyan-400/50 bg-cyan-400/20 disabled:opacity-50" data-hud-card>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href={`/technicians/${id}/txmobile_view`} className="block w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide text-center text-gray-400 border border-white/10" data-hud-card>
            Cancel
          </Link>
          <button type="button" onClick={() => setShowDeleteConfirm(true)} className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide text-red-400 border border-red-400/30 bg-red-400/10" data-hud-card>
            Delete Operative
          </button>
        </div>
      </form>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setShowDeleteConfirm(false)}>
          <div className="rounded-lg p-6 max-w-sm w-full border border-red-400/50 bg-[rgba(13,21,37,0.95)]" onClick={(e) => e.stopPropagation()} data-hud-card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-red-400">Confirm Delete</h3>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="text-gray-400"><FaTimes size={20} /></button>
            </div>
            <p className="text-sm text-gray-300 mb-6">Are you sure you want to delete this operative?</p>
            <div className="flex gap-3">
              <button type="button" onClick={handleDelete} className="flex-1 py-2 rounded-lg text-sm font-bold uppercase text-red-400 border border-red-400/50">Delete</button>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-lg text-sm font-bold uppercase text-gray-400 border border-white/10">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </TechnicianMobileShell>
  );
}

TechnicianMobileEdit.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default TechnicianMobileEdit;
