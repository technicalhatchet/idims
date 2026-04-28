import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaPhone, FaCheckCircle } from 'react-icons/fa';

const STEPS = ['Scheduled', 'In Progress', 'Repairing', 'Completed'];

export default function RepairStatus({ repair }) {
  const {
    id,
    status = 'In Progress',
    service = 'Washer Repair',
    date = 'May 18, 2025',
    orderNumber = 'QR-7824',
    technician = 'Mike Thompson',
    phone = '(419) 555-1234',
    icon = '/applianceicons/neon/neonwasher.png',
    currentStep = 1
  } = repair || {};

  const statusColors = {
    'In Progress': 'bg-orange-500/20 text-orange-400',
    'Scheduled': 'bg-cyan-500/20 text-cyan-400',
    'Repairing': 'bg-yellow-500/20 text-yellow-400',
    'Completed': 'bg-green-500/20 text-green-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="p-6 rounded-2xl bg-white/5 border border-white/10"
    >
      <div className="flex items-start justify-between mb-5">
        <h3 className="text-lg font-semibold text-white">Repair Status</h3>
        <Link href="/cxdashboard/repairs" className="text-cyan-400 text-sm hover:text-cyan-300">
          View All Repairs →
        </Link>
      </div>

      {/* Repair Info */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/10 to-orange-500/10 border border-white/10 flex items-center justify-center">
          <Image src={icon} alt={service} width={35} height={35} className="object-contain" />
        </div>
        <div>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[status]}`}>
            {status}
          </span>
          <h4 className="text-white font-semibold mt-1">{service}</h4>
          <p className="text-gray-400 text-sm">{date} • Order #{orderNumber}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          {STEPS.map((step, i) => (
            <div key={step} className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i <= currentStep
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/10 text-gray-500'
              }`}>
                {i < currentStep ? <FaCheckCircle className="w-4 h-4" /> : i + 1}
              </div>
            </div>
          ))}
        </div>
        
        {/* Progress Bar */}
        <div className="relative h-1.5 bg-white/10 rounded-full">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-500 to-orange-500 rounded-full"
          />
        </div>
        
        {/* Step Labels */}
        <div className="flex justify-between mt-2">
          {STEPS.map((step, i) => (
            <span key={step} className={`text-[10px] ${i <= currentStep ? 'text-white' : 'text-gray-500'}`}>
              {step}
            </span>
          ))}
        </div>
      </div>

      {/* Technician Info */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
        <div>
          <p className="text-gray-400 text-xs">Technician:</p>
          <p className="text-white font-medium text-sm">{technician}</p>
        </div>
        <a
          href={`tel:${phone.replace(/[^0-9]/g, '')}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors"
        >
          <FaPhone className="w-3 h-3" />
          {phone}
        </a>
      </div>
    </motion.div>
  );
}
