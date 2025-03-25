import { createContext, useContext, useState, useEffect } from 'react';

// Default theme object with detailed settings
const defaultTheme = {
  mode: 'light',
  colors: {
    primary: '#4F46E5',
    secondary: '#10B981',
    accent: '#F59E0B',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
    light: '#F3F4F6',
    dark: '#1F2937',
    background: '#FFFFFF',
    text: '#1F2937',
    border: '#E5E7EB',
  },
  fonts: {
    body: 'Inter, system-ui, sans-serif',
    heading: 'Inter, system-ui, sans-serif',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    default: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
};

// Create context with theme object and functions
export const ThemeContext = createContext({
  theme: defaultTheme,
  toggleTheme: () => {},
  updateTheme: () => {}
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(defaultTheme);
  const [mounted, setMounted] = useState(false);
  
  // Only run this effect on the client side
  useEffect(() => {
    setMounted(true);
    
    // Check for saved theme preference or system preference
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('themeMode') : null;
    if (savedTheme) {
      setTheme(prevTheme => ({
        ...prevTheme,
        mode: savedTheme
      }));
    } else if (
      typeof window !== 'undefined' && 
      window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      setTheme(prevTheme => ({
        ...prevTheme,
        mode: 'dark'
      }));
    }
  }, []);
  
  useEffect(() => {
    // Only access the DOM on the client side
    if (typeof window === 'undefined') return;
    
    // Apply theme to document
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save theme preference
    localStorage.setItem('themeMode', theme.mode);
  }, [theme.mode]);
  
  // Function to toggle between light and dark modes
  const toggleTheme = () => {
    setTheme(prevTheme => ({
      ...prevTheme,
      mode: prevTheme.mode === 'light' ? 'dark' : 'light'
    }));
  };
  
  // Function to update specific theme properties
  const updateTheme = (newTheme) => {
    setTheme(prevTheme => ({ ...prevTheme, ...newTheme }));
  };
  
  // Let's prevent a flash of wrong theme while waiting for client-side hydration
  if (!mounted) {
    return <>{children}</>;
  }
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}