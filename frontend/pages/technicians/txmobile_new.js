import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import TechnicianMobileShell, { TX_MOBILE_PAGE_BG } from '../../components/technicians/TechnicianMobileShell';
import { useTechnicianMutations } from '../../hooks/useTechnicians';

function TechnicianMobileNew() {
  const router = useRouter();
  const { create } = useTechnicianMutations();

  const [formData, setFormData] = useState({
    employee_id: '',
    status: 'active',
    hire_date: '',
    specialization: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await create(formData);
      router.push(`/technicians/${result.id}/txmobile_view`);
    } catch (err) {
      setSubmitError(err.message || 'Failed to create technician');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm rounded border text-white bg-[rgba(0,0,0,0.3)] border-orange-400/30';

  return (
    <TechnicianMobileShell
      title="New Operative | Field Tech Dashboard"
      scanKey="tx-new"
      titleplate={
        <div className="flex items-center gap-3">
          <Link href="/techboard/operatives" className="text-orange-400" data-hud-card>
            <FaArrowLeft size={18} />
          </Link>
          <h1 className="tx-new-hud-orbitron text-base font-black uppercase tracking-[0.08em] text-white">New Operative</h1>
        </div>
      }
    >
      {submitError && (
        <div className="rounded-lg p-4 mb-4 text-red-400 border border-red-400/30 bg-red-400/10" data-hud-card>
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="rounded-lg p-4 mb-4 border border-orange-400/30 bg-[rgba(13,21,37,0.85)]" data-hud-card>
          <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wide mb-4">User Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">First Name *</label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Last Name *</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Email *</label>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="rounded-lg p-4 mb-4 border border-orange-400/30 bg-[rgba(13,21,37,0.85)]" data-hud-card>
          <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wide mb-4">Operative Information</h2>
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
              <input type="text" name="specialization" value={formData.specialization} onChange={handleInputChange} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide text-orange-400 border border-orange-400/50 bg-orange-400/20 disabled:opacity-50" data-hud-card>
            {isSubmitting ? 'Creating...' : 'Create Operative'}
          </button>
          <Link href="/techboard/operatives" className="block w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide text-center text-gray-400 border border-white/10" data-hud-card>
            Cancel
          </Link>
        </div>
      </form>
    </TechnicianMobileShell>
  );
}

TechnicianMobileNew.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default TechnicianMobileNew;
