import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { parseISO, format } from 'date-fns';

// CSS for the timeline view content
import styles from '../../styles/TimelineView.module.css';

const TimelineView = ({ appointments, date, onEventClick, viewType, isLoading }) => {
  const [events, setEvents] = useState([]);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);
  const calendarRef = useRef(null); // Ref for FullCalendar API
  
  // Map the parent viewType to FullCalendar view names
  const getFullCalendarView = () => {
    switch(viewType) {
      case 'week':
        return 'timeGridWeek';
      case 'month':
        return 'dayGridMonth';
      case 'day':
      default:
        return 'timeGridDay';
    }
  };

  // Process appointments into events only when not loading and data is available
  useEffect(() => {
    // Don't process if loading or no appointments data
    if (isLoading || !appointments) {
        // Optionally clear events while loading to prevent stale display
        // setEvents([]); 
        return; 
    }

    console.log("Processing appointments (isLoading=false):", appointments);

    // Track unique technicians for coloring
    const uniqueTechnicians = new Set();
    appointments.forEach(appointment => {
      if (appointment.technician_id) {
        uniqueTechnicians.add(appointment.technician_id);
      }
    });
    
    const multipleTechnicians = uniqueTechnicians.size > 1;
    console.log("Multiple technicians:", multipleTechnicians);
    
    // Create a color map for technicians
    const technicianColors = {};
    const colorOptions = [
      '#3b82f6', // blue-500
      '#f97316', // orange-500 
      '#8b5cf6', // violet-500
      '#ec4899', // pink-500
      '#10b981', // emerald-500
      '#f59e0b', // amber-500
      '#6366f1', // indigo-500
      '#ef4444', // red-500
      '#0ea5e9', // sky-500
      '#14b8a6', // teal-500
    ];
    
    // Assign colors to technicians
    let colorIndex = 0;
    uniqueTechnicians.forEach(techId => {
      technicianColors[techId] = colorOptions[colorIndex % colorOptions.length];
      colorIndex++;
    });

    // Format appointments as FullCalendar events
    const formattedEvents = appointments.flatMap(appointment => {
      // Log each appointment for debugging
      console.log("Processing appointment:", {
        id: appointment.id,
        start: appointment.start,
        end: appointment.end,
        type: appointment.appointment_type,
        work_order_id: appointment.work_order_id,
        order_number: appointment.order_number
      });
      
      // Validate and fix start/end times
      let startTime = appointment.start ? new Date(appointment.start) : null;
      let endTime = appointment.end ? new Date(appointment.end) : null;
      
      // Skip invalid appointments
      if (!startTime) {
        console.warn("Skipping appointment with invalid start time:", appointment);
        return [];
      }
      
      // If no end time, default to 1 hour
      if (!endTime) {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      }
      
      // Ensure end time is not before start time
      if (endTime < startTime) {
        console.warn("Fixing invalid end time that is before start time:", appointment);
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      }

      // Determine the color based on whether we're viewing multiple technicians
      let backgroundColor, borderColor;
      
      if (multipleTechnicians && appointment.technician_id) {
        backgroundColor = technicianColors[appointment.technician_id];
        borderColor = backgroundColor;
      } else {
        backgroundColor = getStatusColor(appointment.status);
        borderColor = backgroundColor;
      }

      // Create a single event for this appointment
      const event = {
        id: appointment.id,
        title: appointment.order_number 
          ? `WO #${appointment.order_number} - ${appointment.appointment_type || 'Appointment'}`
          : appointment.title || 'Appointment',
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        extendedProps: {
          ...appointment,
          technician_id: appointment.technician_id,
          work_order_id: appointment.work_order_id || appointment.id,
          order_number: appointment.order_number,
          description: appointment.description || '',
          location: appointment.location || '',
          status: appointment.status || 'scheduled',
          client_name: appointment.client_name || 'No client',
          client_phone: appointment.client_phone || '',
          technician_name: appointment.technician_name || 'Unassigned',
          source: appointment.source || 'work_order',
          appointment_type: appointment.appointment_type || null
        },
        backgroundColor,
        borderColor,
        textColor: '#ffffff',
        allDay: false,
        display: 'block',
        overlap: false
      };

      console.log("Created event:", event);
      return [event];
    }).filter(Boolean);

    console.log("Formatted events:", formattedEvents);
    setEvents(formattedEvents);
  }, [appointments, isLoading]); // Only depend on appointments and isLoading

  // Effect to control the date displayed by FullCalendar when the parent 'date' prop changes
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      // Use the date prop passed from the parent to navigate FullCalendar
      calendarApi.gotoDate(date);
    }
  }, [date]); // Depend only on the date prop

  // Keep day / week / month view in sync when viewType changes (initialView only applies on first mount)
  useEffect(() => {
    if (!calendarRef.current) return;
    const calendarApi = calendarRef.current.getApi();
    calendarApi.changeView(getFullCalendarView());
  }, [viewType]);

  // Helper function to get color based on status
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#22c55e'; // green-500
      case 'in_progress':
        return '#3b82f6'; // blue-500
      case 'cancelled':
        return '#ef4444'; // red-500
      case 'on_hold':
        return '#f97316'; // orange-500
      case 'parts_on_order':
        return '#d97706'; // amber-600
      case 'reschedule':
        return '#0d9488'; // teal-600
      case 'need_to_contact':
        return '#dc2626'; // red-600
      case 'redo':
        return '#4f46e5'; // indigo-600
      default:
        return '#eab308'; // yellow-500
    }
  };
  
  // Handle mouse enter for tooltip
  const handleEventMouseEnter = (info) => {
    const rect = info.el.getBoundingClientRect();
    
    // Set tooltip content and position
    setTooltipContent(info.event.extendedProps);
    setTooltipPosition({
      top: rect.top + window.scrollY,
      left: rect.right + 10 + window.scrollX
    });
  };
  
  // Handle mouse leave for tooltip
  const handleEventMouseLeave = () => {
    setTooltipContent(null);
  };

  // Handle event click
  const handleEventClick = (info) => {
    if (onEventClick) {
      onEventClick(info.event.extendedProps);
    }
  };

  return (
    <div className={styles.timelineContainer}>
      <FullCalendar
        ref={calendarRef} // Assign the ref
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView={getFullCalendarView()}
        // Remove FullCalendar's own navigation header, use parent's
        headerToolbar={false} // Or configure to hide prev/next/today
        /*headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: ''
        }}*/
        events={events}
        slotDuration="00:15:00"
        slotLabelInterval="01:00:00"
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
        allDaySlot={false}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        scrollTime="08:00:00"
        expandRows={true}
        eventClick={handleEventClick}
        eventContent={renderEventContent}
        eventMouseEnter={handleEventMouseEnter}
        eventMouseLeave={handleEventMouseLeave}
        height="auto"
        stickyHeaderDates={true}
        nowIndicator={true}
        dayMaxEvents={false}
        displayEventTime={true}
        displayEventEnd={true}
        eventDisplay="block"
        handleWindowResize={true}
        viewHeight={1400}
        eventOverlap={false}
        slotEventOverlap={false}
        nextDayThreshold="00:00:00"
        forceEventDuration={true}
        eventDurationEditable={false}
        eventResizableFromStart={false}
        eventStartEditable={false}
        eventDragStart={false}
        eventDragStop={false}
        dragRevertDuration={0}
        defaultTimedEventDuration="00:15:00"
      />
      
      {/* Tooltip */}
      {tooltipContent && (
        <div 
          ref={tooltipRef}
          className={styles.eventTooltip}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          <EventTooltipContent extendedProps={tooltipContent} />
        </div>
      )}
    </div>
  );
};

// Custom event rendering
const renderEventContent = (eventInfo) => {
  const { event } = eventInfo;
  const { extendedProps } = event;
  
  // Calculate if the event duration is long enough to show details
  const start = new Date(event.start);
  const end = new Date(event.end);
  const durationMinutes = (end - start) / (1000 * 60);
  
  // Adjust detail levels based on event duration
  const showBasicInfo = durationMinutes >= 15;
  const showFullDetails = durationMinutes >= 30;
  
  const isAppointment = extendedProps.source === 'appointment';
  const isWorkOrder = extendedProps.source === 'work_order';
  
  // Get appointment type with a fallback
  const getAppointmentType = () => {
    if (extendedProps.appointment_type) {
      const type = extendedProps.appointment_type.charAt(0).toUpperCase() + 
                   extendedProps.appointment_type.slice(1);
      return type;
    }
    return 'Appointment';
  };
  
  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔧';
      case 'cancelled':
        return '❌';
      case 'on_hold':
        return '⏸️';
      case 'parts_on_order':
        return '📦';
      case 'reschedule':
        return '📅';
      case 'need_to_contact':
        return '📞';
      case 'redo':
        return '🔄';
      default:
        return '⏱️'; // scheduled
    }
  };
  
  // Get priority icon
  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return '🔴';
      case 'urgent':
        return '⚠️';
      case 'medium':
        return '🟠';
      case 'low':
        return '🟢';
      default:
        return '';
    }
  };
  
  // Formatting the status text
  const formatStatus = (status) => {
    return status === 'need_to_contact' 
      ? 'Need to Contact' 
      : status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };
  
  // Truncate text if it's too long
  const truncate = (text, maxLength = 18) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };
  
  // For very short appointments (less than 15 minutes), show minimal info
  if (durationMinutes < 15) {
    return (
      <div className={styles.eventBlock}>
        <div className={styles.eventMicro}>
          {getPriorityIcon(extendedProps.priority)} WO #{extendedProps.order_number}
        </div>
      </div>
    );
  }
  
  // Determine title based on order number and appointment type
  const title = `WO #${extendedProps.order_number}`;
  
  return (
    <div className={styles.eventBlock}>
      <div className={styles.eventHeader}>
        <div className={styles.eventTitle}>
          {getPriorityIcon(extendedProps.priority)} {title}
        </div>
        <div className={styles.appointmentTypeBadge}>
          {getAppointmentType()}
        </div>
        <div className={styles.eventTime}>
          {format(parseISO(event.startStr), 'h:mm a')} - {format(parseISO(event.endStr), 'h:mm a')}
        </div>
      </div>
      
      {/* Show client and technician for medium duration */}
      {showBasicInfo && (
        <div className={styles.basicInfo}>
          <div className={styles.clientName}>
            <span className={styles.icon}>👤</span> {truncate(extendedProps.client_name || 'No client', 15)}
          </div>
          {extendedProps.client_phone && (
            <div className={styles.clientPhone}>
              <span className={styles.icon}>📞</span> {extendedProps.client_phone}
            </div>
          )}
          <div className={styles.technicianName}>
            <span className={styles.icon}>🔧</span> {truncate(extendedProps.technician_name || 'Unassigned', 15)}
          </div>
        </div>
      )}
      
      {/* Show additional details for longer appointments */}
      {showFullDetails && (
        <div className={styles.detailsSection}>
          {extendedProps.location && (
            <div className={styles.eventLocation}>
              <span className={styles.icon}>📍</span> {truncate(extendedProps.location, 20)}
            </div>
          )}
          <div className={styles.eventStatus}>
            {getStatusIcon(extendedProps.status)} {formatStatus(extendedProps.status)}
          </div>
        </div>
      )}
    </div>
  );
};

// Tooltip content component
const EventTooltipContent = ({ extendedProps }) => {
  if (!extendedProps) return null;
  
  // Format time for display
  const formatTime = (isoString) => {
    if (!isoString) return '';
    return format(parseISO(isoString), 'h:mm a');
  };
  
  // Get appointment type with a fallback
  const getAppointmentType = () => {
    if (extendedProps.appointment_type) {
      const type = extendedProps.appointment_type.charAt(0).toUpperCase() + 
                   extendedProps.appointment_type.slice(1);
      return type;
    }
    return 'Appointment';
  };
  
  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔧';
      case 'cancelled':
        return '❌';
      case 'on_hold':
        return '⏸️';
      case 'parts_on_order':
        return '📦';
      case 'reschedule':
        return '📅';
      case 'need_to_contact':
        return '📞';
      case 'redo':
        return '🔄';
      default:
        return '⏱️'; // scheduled
    }
  };
  
  // Get priority icon
  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return '🔴';
      case 'urgent':
        return '⚠️';
      case 'medium':
        return '🟠';
      case 'low':
        return '🟢';
      default:
        return '';
    }
  };
  
  // Formatting the status text
  const formatStatus = (status) => {
    return status === 'need_to_contact' 
      ? 'Need to Contact' 
      : status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };
  
  // Determine title based on order number and appointment type
  const title = `WO #${extendedProps.order_number}`;
  
  return (
    <div className={styles.tooltipBlock}>
      <div className={styles.tooltipHeader}>
        <div className={styles.tooltipTitle}>
          {getPriorityIcon(extendedProps.priority)} {title}
        </div>
        <div className={styles.appointmentTypeBadge}>
          {getAppointmentType()}
        </div>
        <div className={styles.tooltipTime}>
          {formatTime(extendedProps.start)} - {formatTime(extendedProps.end)}
        </div>
      </div>
      
      <div className={styles.tooltipContent}>
        <div className={styles.tooltipSection}>
          <div className={styles.sectionTitle}>Client Information</div>
          <div className={styles.clientName}>
            <span className={styles.icon}>👤</span> {extendedProps.client_name || 'No client'}
          </div>
          {extendedProps.client_phone && (
            <div className={styles.clientPhone}>
              <span className={styles.icon}>📞</span> {extendedProps.client_phone}
            </div>
          )}
        </div>
        
        <div className={styles.tooltipSection}>
          <div className={styles.sectionTitle}>Appointment Details</div>
          <div className={styles.technicianName}>
            <span className={styles.icon}>🔧</span> {extendedProps.technician_name || 'Unassigned'}
          </div>
          {extendedProps.location && (
            <div className={styles.eventLocation}>
              <span className={styles.icon}>📍</span> {extendedProps.location}
            </div>
          )}
          <div className={styles.eventStatus}>
            {getStatusIcon(extendedProps.status)} {formatStatus(extendedProps.status)}
          </div>
        </div>
        
        {extendedProps.description && (
          <div className={styles.tooltipSection}>
            <div className={styles.sectionTitle}>Description</div>
            <div className={styles.description}>
              {extendedProps.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineView; 