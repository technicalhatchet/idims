import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt } from 'react-icons/fa';

export default function AppointmentCard({ appointment }) {
  const {
    id,
    status = 'Confirmed',
    date = 'Sat, May 24, 2025',
    time = '10:00 AM – 12:00 PM',
    service = 'Refrigerator Repair',
    address = '123 Main St.',
    city = 'Toledo, OH 43604',
    image = '/applianceicons/neon/neonfridge.png'
  } = appointment || {};

  const statusColors = {
    Confirmed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    Pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 rounded-2xl bg-white/5 border border-white/10"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Upcoming Appointment</h3>
        <Link href="/cxdashboard/appointments" className="text-cyan-400 text-sm hover:text-cyan-300">
          View All →
        </Link>
      </div>

      <div className="flex gap-5">
        {/* Appliance Image */}
        <div className="relative w-32 h-32 rounded-xl bg-gradient-to-br from-cyan-500/10 to-orange-500/10 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
          <Image
            src={image}
            alt={service}
            width={70}
            height={70}
            className="object-contain"
          />
        </div>

        {/* Details */}
        <div className="flex-1">
          {/* Status Badge */}
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status]}`}>
            {status}
          </span>

          {/* Date & Time */}
          <div className="mt-3 space-y-1">
            <p className="text-cyan-400 text-sm font-medium">{date}</p>
            <p className="text-white text-xl font-bold">{time}</p>
          </div>

          {/* Service & Address */}
          <div className="mt-3 space-y-1">
            <p className="text-white font-medium">{service}</p>
            <p className="text-gray-400 text-sm">{address}</p>
            <p className="text-gray-400 text-sm">{city}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <Link href={`/cxdashboard/appointments/${id || '1'}`}>
              <button className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors">
                View Details
              </button>
            </Link>
            <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors">
              Reschedule
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
