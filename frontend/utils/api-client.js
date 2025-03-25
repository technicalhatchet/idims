import { getSession } from '@auth0/nextjs-auth0';

// Error types for better error handling
const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTHENTICATION_ERROR',
  SERVER: 'SERVER_ERROR',
  CLIENT: 'CLIENT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
  CORS: 'CORS_ERROR'
};

const getAccessToken = async () => {
  try {
    console.log('Attempting to retrieve access token...');
    // In client-side environment, we need to fetch the token from an API endpoint
    const response = await fetch('/api/auth/session');
    if (!response.ok) {
      console.warn('Failed to retrieve session from API:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // Check all possible locations where the token might be
    const token = data.token || 
                 data.accessToken || 
                 (data.user && data.user.accessToken) ||
                 null;
    
    if (!token) {
      console.warn('No access token found in session data');
      // Log the structure to help debug
      console.log('Session data structure:', JSON.stringify({
        hasToken: !!data.token,
        hasAccessToken: !!data.accessToken,
        hasUserAccessToken: !!(data.user && data.user.accessToken),
        hasUser: !!data.user
      }));
    } else {
      console.log('Successfully retrieved access token');
    }
    
    return token;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null; // Return null instead of throwing to allow API calls to proceed without token
  }
};

// Centralize token handling
const getAuthHeaders = async () => {
  const token = await getAccessToken();
  
  // Log whether we have a token or not
  if (!token) {
    console.warn('No authentication token available for API request');
    return {};
  }
  
  // Make sure token is properly formatted with Bearer prefix
  const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  return { 'Authorization': formattedToken };
};

const classifyError = (error, response = null) => {
  // Classify errors for better handling
  if (error.message && error.message.includes('Failed to fetch')) {
    // Check if this is likely a CORS error
    if (error.message.includes('CORS') || 
        (response && response.type === 'opaque') ||
        error.message.includes('NetworkError')) {
      return ErrorTypes.CORS;
    }
    return ErrorTypes.NETWORK;
  }
  
  if (response) {
    if (response.status === 401 || response.status === 403) {
      return ErrorTypes.AUTH;
    }
    if (response.status >= 500) {
      return ErrorTypes.SERVER;
    }
    if (response.status >= 400) {
      return ErrorTypes.CLIENT;
    }
  }
  
  return ErrorTypes.UNKNOWN;
};

const handleResponse = async (response) => {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  
  if (!response.ok) {
    let errorData;
    try {
      if (isJson) {
        errorData = await response.json();
      } else {
        errorData = await response.text();
      }
    } catch (e) {
      console.error("Error parsing error response:", e);
      errorData = "Unknown error occurred";
    }

    const error = new Error();
    error.status = response.status;
    error.type = classifyError(error, response);
    
    if (typeof errorData === 'object' && errorData !== null) {
      error.message = errorData.message || errorData.detail || "An error occurred";
      error.details = errorData.errors || errorData.error;
    } else {
      error.message = errorData;
    }
    
    console.error(`API Error (${response.status}):`, error);
    throw error;
  }

  if (isJson) {
    try {
      return await response.json();
    } catch (e) {
      console.error("Error parsing JSON response:", e);
      throw new Error("Invalid JSON response from server");
    }
  }
  
  return response.text();
};

// Base request function
const request = async (method, endpoint, data = null, customOptions = {}, retryCount = 0) => {
  try {
    // Clean and construct the URL properly
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const cleanEndpoint = endpoint
      .replace(/^https?:\/\/[^/]+\/api\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/\/+/g, '/')
      .replace(/^api\/?/i, '');
    const url = `${baseUrl.replace(/\/+$/, '')}/${cleanEndpoint}`;

    // Get auth headers
    const authHeaders = await getAuthHeaders();
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...customOptions.headers
    };

    // Debug headers
    console.log('Request headers:', {
      contentType: headers['Content-Type'],
      hasAuth: !!headers.Authorization,
      authPrefix: headers.Authorization ? headers.Authorization.substring(0, 15) + '...' : 'none'
    });

    // If there's no auth token, log but continue
    if (!authHeaders.Authorization) {
      console.warn(`Making unauthenticated request to ${endpoint}`);
    } else {
      console.log(`Making authenticated request to ${endpoint}`);
    }

    // Prepare request options
    const options = {
      method,
      headers,
      credentials: 'include', // Include cookies for sessions
      ...customOptions
    };

    // Add body for methods that support it
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(data);
    }

    // Log request details for debugging
    console.log(`API Request: ${method} ${url}`);

    try {
      // Make the request
      const response = await fetch(url, options);

      // Log response status for debugging
      console.log(`API Response: ${response.status} ${response.statusText} for ${method} ${url}`);

      // Handle response
      return await handleResponse(response);
    } catch (error) {
      console.error(`Network error on ${method} ${url}:`, error);
      throw error;
    }
  } catch (error) {
    // If not already classified, classify the error
    if (!error.type) {
      error.type = classifyError(error);
    }
    
    // If auth error and not already retried, force refresh the token and retry once
    if (error.type === ErrorTypes.AUTH && retryCount === 0) {
      console.log('Authentication error, refreshing token and retrying...');
      try {
        // Force refresh the session by requesting a new token
        await fetch('/api/auth/refresh', { method: 'POST' });
        console.log('Token refresh completed, retrying request');
        
        // Retry the request with the new token
        return request(method, endpoint, data, customOptions, retryCount + 1);
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
      }
    }
    
    console.error(`API ${method} error:`, error);
    throw error;
  }
};

// Legacy function for backward compatibility
const apiClient = async (endpoint, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : null;
  
  return request(method, endpoint, body, {
    headers: options.headers || {},
    ...options
  });
};

// REST API client with HTTP method functions
apiClient.get = (endpoint, options = {}) => {
  return request('GET', endpoint, null, options);
};

apiClient.post = (endpoint, data, options = {}) => {
  return request('POST', endpoint, data, options);
};

apiClient.put = (endpoint, data, options = {}) => {
  return request('PUT', endpoint, data, options);
};

apiClient.patch = (endpoint, data, options = {}) => {
  return request('PATCH', endpoint, data, options);
};

apiClient.delete = (endpoint, options = {}) => {
  return request('DELETE', endpoint, null, options);
};

// Export ErrorTypes for use in components
apiClient.ErrorTypes = ErrorTypes;

export { apiClient, ErrorTypes };
export default apiClient;