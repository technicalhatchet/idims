import { createContext, useContext, useState, useEffect } from 'react';

// Create context
const SidebarContext = createContext();

export function SidebarProvider({ children }) {
  // State for sidebar (expanded/collapsed and mobile open/closed)
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Check if we're on a mobile screen
  const isMobile = () => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  };
  
  // On initial load, check screen size and collapse sidebar if mobile
  useEffect(() => {
    if (isMobile()) {
      setIsExpanded(false);
    }
    
    // Handle window resize
    const handleResize = () => {
      if (isMobile()) {
        setIsMobileOpen(false); // Close mobile drawer on resize
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Toggle sidebar expansion (desktop)
  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Open/close mobile sidebar
  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };
  
  // Close mobile sidebar
  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
  };
  
  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        isMobileOpen,
        toggleSidebar,
        toggleMobileSidebar,
        closeMobileSidebar
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

// Custom hook to use the sidebar context
export function useSidebar() {
  return useContext(SidebarContext);
}