import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';

export default withApiAuthRequired(async function handler(req, res) {
  try {
    // Get token from Auth0
    const { accessToken } = await getAccessToken(req, res, {
      scopes: ['openid', 'profile', 'email']
    });
    
    console.log('Direct test with token:', accessToken.substring(0, 10) + '...');
    
    // Call both endpoints to compare
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    console.log('Using base URL:', baseUrl);

    // Try different path variations with the correct /api prefix
    const pathVariations = [
      '/api/work-orders',
      '/api/work-orders-headers-debug',
      '/api/work-orders-token-debug',
      '/api/health'
    ];
    
    // Create test variations of the Authorization header
    const testCases = [
      {
        name: 'Standard Bearer',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Lowercase authorization',
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Raw token (no Bearer)',
        headers: {
          'Authorization': accessToken,
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Extra headers',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Client': 'direct-test',
          'Origin': process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'
        }
      }
    ];
    
    // Run each path variation with the standard header
    console.log('Testing path variations to find correct endpoint:');
    const standardHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // Results array
    const results = [];

    // Test path variations first
    for (const path of pathVariations) {
      const fullUrl = `${baseUrl}${path}`;
      console.log(`Testing path: ${fullUrl}`);
      
      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: standardHeaders
        });
        
        const status = response.status;
        const statusText = response.statusText;
        
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
          endpoint: 'path-test',
          testCase: path,
          url: fullUrl,
          status,
          statusText,
          responseBody: typeof responseBody === 'string' ? responseBody : 
                       (response.ok ? { itemCount: responseBody?.items?.length || 0 } : responseBody)
        });
      } catch (e) {
        results.push({
          endpoint: 'path-test',
          testCase: path,
          url: fullUrl,
          error: e.message
        });
      }
    }

    // Now continue with the original test cases using the correct /api prefix
    const workOrdersUrl = `${baseUrl}/api/work-orders?page=1&limit=10`;
    const debugUrl = `${baseUrl}/api/work-orders-headers-debug`;
    const tokenDebugUrl = `${baseUrl}/api/work-orders-token-debug`;
    
    // Run all test cases against both endpoints (only if we found a working path)
    const workingPaths = results.filter(r => r.status === 200);
    if (workingPaths.length > 0) {
      console.log('Found working paths:', workingPaths.map(p => p.testCase).join(', '));
      
      for (const testCase of testCases) {
        // Test against work orders endpoint
        try {
          console.log(`Testing ${testCase.name} against work-orders endpoint`);
          const workOrdersResponse = await fetch(workOrdersUrl, {
            method: 'GET',
            headers: testCase.headers
          });
          
          const status = workOrdersResponse.status;
          const ok = workOrdersResponse.ok;
          const statusText = workOrdersResponse.statusText;
          
          // Get response headers
          const responseHeaders = {};
          workOrdersResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          
          // Try to parse body
          let responseBody = null;
          try {
            if (ok) {
              responseBody = await workOrdersResponse.json();
            } else {
              responseBody = await workOrdersResponse.text();
            }
          } catch (e) {
            responseBody = `Error parsing response: ${e.message}`;
          }
          
          results.push({
            endpoint: 'work-orders',
            testCase: testCase.name,
            requestHeaders: testCase.headers,
            status,
            ok,
            statusText,
            responseHeaders,
            responseBody: ok ? { 
              items: responseBody?.items?.length || 0,
              total: responseBody?.total || 0
            } : responseBody
          });
        } catch (e) {
          results.push({
            endpoint: 'work-orders',
            testCase: testCase.name,
            requestHeaders: testCase.headers,
            error: e.message
          });
        }
        
        // Test against debug endpoint
        try {
          console.log(`Testing ${testCase.name} against debug endpoint`);
          const debugResponse = await fetch(debugUrl, {
            method: 'GET',
            headers: testCase.headers
          });
          
          const status = debugResponse.status;
          const ok = debugResponse.ok;
          const statusText = debugResponse.statusText;
          
          // Get response headers
          const responseHeaders = {};
          debugResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          
          // Try to parse body
          let responseBody = null;
          try {
            responseBody = await debugResponse.json();
          } catch (e) {
            responseBody = `Error parsing response: ${e.message}`;
          }
          
          results.push({
            endpoint: 'debug',
            testCase: testCase.name,
            requestHeaders: testCase.headers,
            status,
            ok,
            statusText,
            responseHeaders,
            responseBody
          });
        } catch (e) {
          results.push({
            endpoint: 'debug',
            testCase: testCase.name,
            requestHeaders: testCase.headers,
            error: e.message
          });
        }
        
        // Test against token debug endpoint
        try {
          console.log(`Testing ${testCase.name} against token debug endpoint`);
          const tokenDebugResponse = await fetch(tokenDebugUrl, {
            method: 'GET',
            headers: testCase.headers
          });
          
          const status = tokenDebugResponse.status;
          const ok = tokenDebugResponse.ok;
          const statusText = tokenDebugResponse.statusText;
          
          // Get response headers
          const responseHeaders = {};
          tokenDebugResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          
          // Try to parse body
          let responseBody = null;
          try {
            responseBody = await tokenDebugResponse.json();
          } catch (e) {
            responseBody = `Error parsing response: ${e.message}`;
          }
          
          results.push({
            endpoint: 'token-debug',
            testCase: testCase.name,
            requestHeaders: testCase.headers,
            status,
            ok,
            statusText,
            responseHeaders,
            responseBody
          });
        } catch (e) {
          results.push({
            endpoint: 'token-debug',
            testCase: testCase.name,
            requestHeaders: testCase.headers,
            error: e.message
          });
        }
      }
    } else {
      console.log('No working paths found, skipping header tests');
    }
    
    console.log('Direct test complete with', results.length, 'test cases');
    
    // Return the results
    res.status(200).json({
      results,
      token: accessToken.substring(0, 10) + '...',
      tokenLength: accessToken.length,
      baseUrl,
      foundWorkingPaths: workingPaths.length > 0,
      workingPaths: workingPaths.map(p => p.testCase)
    });
  } catch (error) {
    console.error('Direct test error:', error);
    res.status(500).json({
      error: error.message
    });
  }
}); 