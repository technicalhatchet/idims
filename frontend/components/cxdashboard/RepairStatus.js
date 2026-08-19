import ApplianceIcon from './ApplianceIcon';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaPhone, FaCheckCircle } from 'react-icons/fa';
import { PORTAL_REPAIR_STEPS } from '../../utils/portalWorkOrderDisplay';

export default function RepairStatus({ repair }) {
  const {
    status = 'In Progress',
    service = 'Washer Repair',
    date = 'May 18, 2025',
    orderNumber = 'QR-7824',
    technician = 'Mike Thompson',
    phone = '(419) 555-1234',
    icon = 'washer',
    currentStep = 1,
    partsNote = null,
  } = repair || {};

  const steps = PORTAL_REPAIR_STEPS;
  const progressPct = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 0;

  const statusColors = {
    'In Progress': 'bg-orange-500/20 text-orange-400',
    Scheduled: 'bg-cyan-500/20 text-cyan-400',
    'Waiting on Parts': 'bg-violet-500/20 text-violet-300',
    'Parts on Order': 'bg-blue-500/20 text-blue-300',
    'Pending Payment': 'bg-amber-500/20 text-amber-300',
    'Awaiting Payment': 'bg-amber-500/20 text-amber-300',
    Completed: 'bg-green-500/20 text-green-400',
    Closed: 'bg-green-500/20 text-green-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="p-6 rounded-2xl bg-white/5 border border-white/10"
    >
      <div className="flex items-start justify-between mb-5 gap-3">
        <h3 className="text-lg font-semibold text-white">Repair Status</h3>
        <Link href="/cxdashboard/repairs" className="text-cyan-400 text-sm hover:text-cyan-300 shrink-0">
          View All Repairs →
        </Link>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/10 to-orange-500/10 border border-white/10 flex items-center justify-center shrink-0">
          <ApplianceIcon type={icon} className="w-8 h-8" />
        </div>
        <div className="min-w-0">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || statusColors['In Progress']}`}>
            {status}
          </span>
          <h4 className="text-white font-semibold mt-1 break-words">{service}</h4>
          <p className="text-gray-400 text-sm mt-1">{date}</p>
          <p className="text-gray-500 text-sm">Order #{orderNumber}</p>
          {partsNote && (
            <p className="text-amber-300/90 text-xs mt-2 leading-snug">{partsNote}</p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between mb-2 gap-1">
          {steps.map((step, i) => (
            <div key={step} className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i <= currentStep ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-500'
                }`}
              >
                {i < currentStep ? <FaCheckCircle className="w-4 h-4" /> : i + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="relative h-1.5 bg-white/10 rounded-full">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-500 to-orange-500 rounded-full"
          />
        </div>

        <div className="flex justify-between mt-2 gap-1">
          {steps.map((step, i) => (
            <span
              key={step}
              className={`text-[10px] leading-tight text-center flex-1 min-w-0 px-0.5 ${
                i <= currentStep ? 'text-white' : 'text-gray-500'
              }`}
            >
              {step}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 gap-3">
        <div className="min-w-0">
          <p className="text-gray-400 text-xs">Technician:</p>
          <p className="text-white font-medium text-sm truncate">{technician}</p>
        </div>
        <a
          href={`tel:${phone.replace(/[^0-9]/g, '')}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors shrink-0"
        >
          <FaPhone className="w-3 h-3" />
          {phone}
        </a>
      </div>
    </motion.div>
  );
}
