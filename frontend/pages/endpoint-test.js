import React, { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import DashboardLayout from '../components/layouts/DashboardLayout';

// Base URL for API calls
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export default function EndpointTest() {
  const { user, isLoading } = useUser();
  const [results, setResults] = useState({});
  const [token, setToken] = useState(null);

  // Get the access token
  useEffect(() => {
    async function getToken() {
      try {
        const res = await fetch('/api/auth/token');
        if (res.ok) {
          const data = await res.json();
          setToken(data.accessToken);
        }
      } catch (error) {
        console.error('Error fetching token:', error);
      }
    }
    if (user) {
      getToken();
    }
  }, [user]);

  const runTests = async () => {
    if (!token) {
      alert('No authentication token available');
      return;
    }

    // Define test cases
    const endpointTests = [
      // Test API client with different patterns
      { name: 'clients (direct)', endpoint: 'clients', type: 'client' },
      { name: 'clients with limit', endpoint: 'clients?limit=100', type: 'client' },
      { name: 'clients with api/ prefix', endpoint: 'api/clients', type: 'client' },
      { name: 'clients with api/ prefix and limit', endpoint: 'api/clients?limit=100', type: 'client' },
      
      { name: 'technicians (direct)', endpoint: 'technicians', type: 'client' },
      { name: 'technicians with limit', endpoint: 'technicians?limit=100', type: 'client' },
      { name: 'technicians with api/ prefix', endpoint: 'api/technicians', type: 'client' },
      { name: 'technicians with api/ prefix and limit', endpoint: 'api/technicians?limit=100', type: 'client' },
      
      { name: 'services (direct)', endpoint: 'services', type: 'client' },
      { name: 'services with limit', endpoint: 'services?limit=100', type: 'client' },
      { name: 'services with api/ prefix', endpoint: 'api/services', type: 'client' },
      { name: 'services with api/ prefix and limit', endpoint: 'api/services?limit=100', type: 'client' },
      
      // Test direct fetch with different patterns
      { name: 'direct fetch: /clients', url: `${API_BASE_URL}/clients`, type: 'fetch' },
      { name: 'direct fetch: /clients?limit=100', url: `${API_BASE_URL}/clients?limit=100`, type: 'fetch' },
      { name: 'direct fetch: /api/clients', url: `${API_BASE_URL}/api/clients`, type: 'fetch' },
      { name: 'direct fetch: /api/clients?limit=100', url: `${API_BASE_URL}/api/clients?limit=100`, type: 'fetch' }
    ];

    // Run all tests and collect results
    const testResults = {};
    
    // Helper function to run a single test
    const runTest = async (test) => {
      try {
        let result;
        
        if (test.type === 'client') {
          // Use API client for test
          const apiClient = (await import('../utils/api-client')).default;
          result = await apiClient.get(test.endpoint);
          return {
            success: true,
            data: result,
            url: `(Used API client with endpoint: ${test.endpoint})`
          };
        } else {
          // Direct fetch
          const res = await fetch(test.url, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          let data;
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await res.json();
          } else {
            data = await res.text();
          }
          
          return {
            success: res.ok,
            status: res.status,
            statusText: res.statusText,
            data,
            url: test.url
          };
        }
      } catch (error) {
        console.error(`Test failed for ${test.name}:`, error);
        return {
          success: false,
          error: error.message,
          stack: error.stack,
          url: test.type === 'client' ? test.endpoint : test.url
        };
      }
    };

    // Run tests in sequence to see progress
    for (const test of endpointTests) {
      setResults(prev => ({
        ...prev,
        [test.name]: { status: 'Running...' }
      }));
      
      const result = await runTest(test);
      
      setResults(prev => ({
        ...prev,
        [test.name]: result
      }));
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">API Endpoint Test</h1>
      
      <p className="mb-4">
        This page tests API endpoints with different patterns to diagnose what works
        and what doesn't.
      </p>
      
      <div className="mb-6">
        <button
          onClick={runTests}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Run All Tests
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {Object.entries(results).map(([name, result]) => (
          <div key={name} className={`border p-4 rounded ${result.success ? 'border-green-500' : 'border-red-500'}`}>
            <h2 className="font-bold">{name}</h2>
            <p className="text-sm text-gray-600 mb-2">{result.url}</p>
            
            {result.status && (
              <p className="text-sm">Status: {result.status} {result.statusText}</p>
            )}
            
            {result.error && (
              <div className="mt-2">
                <p className="text-red-500">Error: {result.error}</p>
              </div>
            )}
            
            {result.data && (
              <div className="mt-2">
                <details>
                  <summary className="cursor-pointer text-sm font-medium">View Response Data</summary>
                  <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-auto max-h-60">
                    {typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.data}
                  </pre>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

EndpointTest.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
}; 