import { FaMapMarkerAlt, FaCar, FaRoad } from 'react-icons/fa';

/**
 * Component to display travel time and distance information
 * @param {Object} props
 * @param {number} props.travelTimeBefore - Travel time to appointment in seconds
 * @param {number} props.travelTimeAfter - Travel time from appointment in seconds
 * @param {number} props.travelDistanceBefore - Travel distance to appointment in meters
 * @param {number} props.travelDistanceAfter - Travel distance from appointment in meters
 * @param {boolean} props.compact - Whether to display in compact format
 * @returns {JSX.Element}
 */
export default function TravelTimeInfo({
  travelTimeBefore,
  travelTimeAfter,
  travelDistanceBefore,
  travelDistanceAfter,
  compact = false
}) {
  // Convert seconds to minutes and format as human-readable
  const formatTravelTime = (seconds) => {
    if (!seconds) return 'N/A';
    
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  };
  
  // Convert meters to miles and format with 1 decimal place
  const formatDistance = (meters) => {
    if (!meters) return 'N/A';
    const miles = (meters / 1609.34).toFixed(1);
    return `${miles} mi`;
  };
  
  // Check if any travel data exists
  const hasTravelData = travelTimeBefore || travelTimeAfter || 
                        travelDistanceBefore || travelDistanceAfter;
                        
  if (!hasTravelData) {
    return compact ? null : (
      <div className="text-gray-500 dark:text-gray-400 text-sm italic">
        No travel information available
      </div>
    );
  }
  
  if (compact) {
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <FaCar className="text-gray-400" />
        <span>{formatTravelTime(travelTimeBefore)}</span>
        <FaRoad className="text-gray-400 ml-2" />
        <span>{formatDistance(travelDistanceBefore)}</span>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mt-2">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
        <FaMapMarkerAlt className="mr-1" /> Travel Information
      </h4>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-gray-500 dark:text-gray-400">To Appointment:</div>
          <div className="flex items-center mt-1">
            <FaCar className="text-gray-400 mr-2" />
            <span className="font-medium dark:text-gray-200">{formatTravelTime(travelTimeBefore)}</span>
          </div>
          <div className="flex items-center mt-1">
            <FaRoad className="text-gray-400 mr-2" />
            <span className="font-medium dark:text-gray-200">{formatDistance(travelDistanceBefore)}</span>
          </div>
        </div>
        
        <div>
          <div className="text-gray-500 dark:text-gray-400">From Appointment:</div>
          <div className="flex items-center mt-1">
            <FaCar className="text-gray-400 mr-2" />
            <span className="font-medium dark:text-gray-200">{formatTravelTime(travelTimeAfter)}</span>
          </div>
          <div className="flex items-center mt-1">
            <FaRoad className="text-gray-400 mr-2" />
            <span className="font-medium dark:text-gray-200">{formatDistance(travelDistanceAfter)}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 