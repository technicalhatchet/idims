import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUser, FaClipboardList, FaTasks } from 'react-icons/fa';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import StatusBadge from '../ui/StatusBadge';
import Link from 'next/link';

export default function EventDetailModal({ event, onClose }) {
  if (!event) return null;
  
  const isAppointment = event.source === 'appointment';
  const workOrderId = event.work_order_id || (event.source === 'work_order' ? event.id : null);
  
  return (
    <Modal isOpen={true} onClose={onClose} title={isAppointment ? "Appointment Details" : "Work Order Details"}>
      <div className="p-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          {event.title || "Untitled"}
          {isAppointment && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
              {event.appointment_type || 'Appointment'}
            </span>
          )}
        </h2>
        
        <div className="space-y-4">
          <div className="flex justify-between">
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <StatusBadge status={event.status} />
            </div>
            {event.order_number && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Work Order #{event.order_number}
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <FaCalendarAlt className="mr-2 text-gray-500 dark:text-gray-500" />
              <span>
                {event.start ? format(parseISO(event.start), 'MMMM d, yyyy') : 'Not scheduled'}
              </span>
            </div>
            
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <FaClock className="mr-2 text-gray-500 dark:text-gray-500" />
              <span>
                {event.start ? format(parseISO(event.start), 'h:mm a') : ''} - 
                {event.end ? format(parseISO(event.end), ' h:mm a') : ' TBD'}
              </span>
            </div>
            
            {event.location && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <FaMapMarkerAlt className="mr-2 text-gray-500 dark:text-gray-500" />
                <span>{event.location}</span>
              </div>
            )}
            
            {event.technician_name && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <FaUser className="mr-2 text-gray-500 dark:text-gray-500" />
                <span>Technician: {event.technician_name}</span>
              </div>
            )}
            
            {event.client_name && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <FaUser className="mr-2 text-gray-500 dark:text-gray-500" />
                <span>Client: {event.client_name}</span>
              </div>
            )}
            
            {event.priority && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <FaTasks className="mr-2 text-gray-500 dark:text-gray-500" />
                <span>Priority: </span>
                <span className={`ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  event.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  event.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                  {event.priority.charAt(0).toUpperCase() + event.priority.slice(1)}
                </span>
              </div>
            )}
          </div>
          
          {event.description && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{event.description}</p>
            </div>
          )}
          
          {isAppointment && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="bg-indigo-50 dark:bg-indigo-900 p-3 rounded-md">
                <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-1">Appointment Info</h3>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  This is a scheduled appointment for the work order.
                  {workOrderId && (
                    <span> You can view and manage all appointments in the work order details page.</span>
                  )}
                </p>
              </div>
            </div>
          )}
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-end space-x-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
            
            {workOrderId && (
              <Link href={`/work_orders/${workOrderId}`} passHref>
                <Button
                  variant="primary"
                >
                  View Work Order
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
} 