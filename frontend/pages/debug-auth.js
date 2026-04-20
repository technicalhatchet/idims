// pages/debug-auth.js
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import API from '../utils/api-client';
import { getSession, clearSession } from '../utils/auth';

// Base URL for API calls
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export default function DebugAuth() {
  const [session, setSession] = useState(null);
  const [apiResults, setApiResults] = useState({
    health: { status: 'pending', data: null, error: null },
    healthNoPrefix: { status: 'pending', data: null, error: null },
    apiHealth: { status: 'pending', data: null, error: null },
    apiHealthNoPrefix: { status: 'pending', data: null, error: null }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const userSession = await getSession();
      setSession(userSession);
      setLoading(false);
    }
    loadSession();
  }, []);

  useEffect(() => {
    if (!loading && session) {
      testEndpoints();
    }
  }, [loading, session]);

  const testEndpoints = async () => {
    // Reset results
    setApiResults({});

    // Client tests - using API client directly
    const runClientTest = async (endpoint) => {
      try {
        console.log(`Testing client endpoint: ${endpoint}`);
        // Import API client
        const apiClient = (await import('../utils/api-client')).default;
        
        // Use API client to make request - this handles auth and URL construction
        const result = await apiClient.get(endpoint);
        return { 
          success: true, 
          status: 'Success', 
          data: result
        };
      } catch (error) {
        console.error(`Client test failed for ${endpoint}:`, error);
        return { 
          success: false, 
          status: error.message || 'Failed',
          error: error.stack
        };
      }
    };

    // Test multiple combinations to diagnose routing issues
    const testCases = [
      // Direct URL tests (require proper URL formatting)
      { key: 'basicHealth', url: `${API_BASE_URL}/basic-health`, useClient: false },
      { key: 'health', url: `${API_BASE_URL}/health`, useClient: false },
      { key: 'workOrders', url: `${API_BASE_URL}/work-orders`, useClient: false },
      { key: 'authDebug', url: `${API_BASE_URL}/auth-debug`, useClient: false },
      
      // Client-based tests (API client handles URL construction)
      { key: 'clientBasicHealth', endpoint: 'basic-health', useClient: true },
      { key: 'clientHealth', endpoint: 'health', useClient: true },
      { key: 'clientWorkOrders', endpoint: 'work-orders', useClient: true },
      { key: 'clientAuthDebug', endpoint: 'auth-debug', useClient: true },
      
      // Test different prefixes with client (our apiClient should handle these)
      { key: 'clientApiHealth', endpoint: 'api/health', useClient: true },
      { key: 'clientApiWorkOrders', endpoint: 'api/work-orders', useClient: true },
      
      // Test problematic endpoints with query parameters
      { key: 'clientsLimit100', endpoint: 'clients?limit=100', useClient: true },
      { key: 'clientsWithApiLimit100', endpoint: 'api/clients?limit=100', useClient: true },
      { key: 'techniciansLimit100', endpoint: 'technicians?limit=100', useClient: true },
      { key: 'techniciansWithApiLimit100', endpoint: 'api/technicians?limit=100', useClient: true },
      { key: 'servicesLimit100', endpoint: 'services?limit=100', useClient: true },
      { key: 'servicesWithApiLimit100', endpoint: 'api/services?limit=100', useClient: true },
      
      // Direct URL tests with query parameters
      { key: 'directClientsLimit100', url: `${API_BASE_URL}/clients?limit=100`, useClient: false },
      { key: 'directApiClientsLimit100', url: `${API_BASE_URL}/api/clients?limit=100`, useClient: false },
      { key: 'directTechniciansLimit100', url: `${API_BASE_URL}/technicians?limit=100`, useClient: false },
      { key: 'directApiTechniciansLimit100', url: `${API_BASE_URL}/api/technicians?limit=100`, useClient: false },
      { key: 'directServicesLimit100', url: `${API_BASE_URL}/services?limit=100`, useClient: false },
      { key: 'directApiServicesLimit100', url: `${API_BASE_URL}/api/services?limit=100`, useClient: false }
    ];

    // Run a single test
    const runTest = async (test) => {
      setApiResults(prev => ({
        ...prev,
        [test.key]: { status: 'Running...' }
      }));

      try {
        let result;
        
        if (test.useClient) {
          // Use API client for the test
          result = await runClientTest(test.endpoint);
        } else {
          // Direct fetch for API tests
          const res = await fetch(test.url, {
            headers: {
              'Authorization': `Bearer ${session?.accessToken || ''}`
            },
            credentials: 'include' // Include cookies for CORS requests
          });
          
          // Try to parse response as JSON
          let data;
          try {
            data = await res.json();
          } catch (e) {
            data = await res.text();
          }
          
          result = {
            success: res.ok,
            status: res.status,
            statusText: res.statusText,
            data
          };
        }

        setApiResults(prev => ({
          ...prev,
          [test.key]: result
        }));
      } catch (error) {
        console.error(`Test failed for ${test.key}:`, error);
        setApiResults(prev => ({
          ...prev,
          [test.key]: {
            success: false,
            status: 'Error',
            error: error.message,
            stack: error.stack
          }
        }));
      }
    };

    // Run tests in parallel
    await Promise.all(
      testCases.map(async (test) => {
        await runTest(test);
      })
    );
  };

  if (loading) {
    return <div className="container p-4">Loading session data...</div>;
  }

  return (
    <div className="container p-4">
      <h1 className="text-2xl font-bold mb-4">Auth Debug Page</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Session Status</h2>
        {session ? (
          <div className="bg-green-100 p-3 rounded">
            <p className="font-semibold text-green-800">✅ Authenticated</p>
            <p>User: {session.user?.email || 'Unknown'}</p>
            <p>Token: {session.accessToken ? `${session.accessToken.substring(0, 15)}...` : 'None'}</p>
            <button 
              onClick={() => {
                clearSession();
                setSession(null);
              }}
              className="mt-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="bg-red-100 p-3 rounded">
            <p className="font-semibold text-red-800">❌ Not authenticated</p>
            <Link href="/login" className="mt-2 inline-block bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
              Login
            </Link>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">API Endpoint Tests</h2>
        <button
          onClick={testEndpoints}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
        >
          Run Tests Again
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(apiResults).map(([key, result]) => (
            <div key={key} className="border rounded p-3">
              <h3 className="font-bold">{key}</h3>
              <div className={`mt-2 p-2 rounded ${getStatusColor(result.status)}`}>
                <p>Status: {result.status}</p>
                {result.error && (
                  <div className="mt-2">
                    <p className="font-semibold">Error: {result.error.message}</p>
                    {result.error.details && (
                      <pre className="text-xs mt-1 bg-gray-100 p-2 overflow-auto max-h-32">
                        {typeof result.error.details === 'object' 
                          ? JSON.stringify(result.error.details, null, 2)
                          : result.error.details}
                      </pre>
                    )}
                  </div>
                )}
                {result.data && (
                  <pre className="text-xs mt-1 bg-gray-100 p-2 overflow-auto max-h-32">
                    {typeof result.data === 'object' 
                      ? JSON.stringify(result.data, null, 2)
                      : result.data}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <Link href="/" className="text-blue-500 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

// Helper function to get color based on status
function getStatusColor(status) {
  switch (status) {
    case 'success': return 'bg-green-100';
    case 'error': return 'bg-red-100';
    case 'loading': return 'bg-yellow-100';
    default: return 'bg-gray-100';
  }
} 