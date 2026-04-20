export default async function handler(req, res) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    
    // Try to reach the backend with different path combinations
    const testEndpoints = [
      { name: 'health', path: '/health' },
      { name: 'api/health', path: '/api/health' },
      { name: 'work-orders', path: '/work-orders' },
      { name: 'api/work-orders', path: '/api/work-orders' },
    ];
    
    const results = [];
    
    for (const endpoint of testEndpoints) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${backendUrl}${endpoint.path}`, { 
          method: 'GET',
          timeout: 3000 
        });
        const responseTime = Date.now() - startTime;
        
        let responseBody = null;
        try {
          if (response.ok) {
            responseBody = await response.json();
          } else {
            responseBody = await response.text();
          }
        } catch (e) {
          responseBody = `Error parsing response: ${e.message}`;
        }
        
        results.push({
          endpoint: endpoint.name,
          url: `${backendUrl}${endpoint.path}`,
          status: response.status,
          statusText: response.statusText,
          responseTime,
          ok: response.ok,
          body: responseBody
        });
      } catch (error) {
        results.push({
          endpoint: endpoint.name,
          url: `${backendUrl}${endpoint.path}`,
          error: error.message
        });
      }
    }
    
    // Return configuration and status
    res.status(200).json({
      backendUrl,
      results,
      correctPath: results.find(r => r.ok)?.endpoint || null,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL || 'not set'
      }
    });
  } catch (error) {
    console.error('Backend status check error:', error);
    res.status(500).json({
      error: error.message
    });
  }
} 