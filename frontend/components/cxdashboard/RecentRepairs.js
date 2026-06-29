import ApplianceIcon from './ApplianceIcon';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';

const SAMPLE_REPAIRS = [
  {
    id: 'QR-7812',
    service: 'Oven Repair',
    date: 'May 10, 2025',
    status: 'Completed',
    price: '$245.00',
    icon: '/applianceicons/neon/neonrange.png'
  },
  {
    id: 'QR-7789',
    service: 'Washer Repair',
    date: 'Apr 25, 2025',
    status: 'Completed',
    price: '$185.00',
    icon: '/applianceicons/neon/neonwasher.png'
  }
];

export default function RecentRepairs({ repairs = SAMPLE_REPAIRS }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="p-6 rounded-2xl bg-white/5 border border-white/10"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-white">Recent Repairs</h3>
        <Link href="/cxdashboard/repairs" className="text-cyan-400 text-sm hover:text-cyan-300">
          View All →
        </Link>
      </div>

      <div className="space-y-3">
        {repairs.map((repair, i) => (
          <motion.div
            key={repair.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/10 to-orange-500/10 flex items-center justify-center">
              <ApplianceIcon type={repair.icon} className="w-6 h-6" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{repair.service}</p>
              <p className="text-gray-400 text-xs">
                {repair.date} • <span className="text-green-400">{repair.status}</span>
              </p>
              <p className="text-gray-500 text-xs">Order #{repair.orderNumber || repair.id}</p>
            </div>

            <div className="text-right">
              <p className="text-white font-semibold">{repair.price}</p>
              <Link href={`/cxdashboard/repairs?order=${encodeURIComponent(repair.orderNumber || repair.id)}`}>
                <button className="mt-1 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:text-white hover:bg-white/10 transition-colors">
                  View Details
                </button>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      <Link href="/cxdashboard/repairs" className="block mt-4">
        <button className="w-full py-3 rounded-xl border border-white/10 text-cyan-400 text-sm font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
          View All Repairs
          <FaArrowRight className="w-3 h-3" />
        </button>
      </Link>
    </motion.div>
  );
}
