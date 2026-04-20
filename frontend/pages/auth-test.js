import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import Layout from '../components/layouts/DashboardLayout';
import { Box, Button, Card, CardContent, Typography, Grid, Alert, Paper, Divider, CircularProgress, Chip } from '@mui/material';
import { apiClient } from '../utils/api-client';
import { useAuthorizedFetch } from '../hooks/useAuthorizedFetch';

export default function AuthTest() {
  const { user, error, isLoading } = useUser();
  const [sessionData, setSessionData] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  
  const [backendResponse, setBackendResponse] = useState(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState(null);

  const fetchSession = async () => {
    setSessionLoading(true);
    setSessionError(null);
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      setSessionData(data);
      console.log("Session data:", data);
    } catch (err) {
      console.error("Session fetch error:", err);
      setSessionError(err.message);
    } finally {
      setSessionLoading(false);
    }
  };

  const testBackendAuth = async () => {
    setBackendLoading(true);
    setBackendError(null);
    try {
      const response = await apiClient('auth0-test');
      setBackendResponse(response);
      console.log("Backend auth test response:", response);
    } catch (err) {
      console.error("Backend auth test failed:", err);
      setBackendError(err.message || "Failed to authenticate with backend");
    } finally {
      setBackendLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSession();
    }
  }, [user]);

  return (
    <Layout>
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" gutterBottom>
          Auth0 Integration Test
        </Typography>

        {isLoading && <CircularProgress />}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Authentication Error: {error.message}
          </Alert>
        )}

        {!user && !isLoading && (
          <Alert severity="info" sx={{ mb: 3 }}>
            You are not logged in. Please log in to test Auth0 integration.
          </Alert>
        )}

        {user && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Auth0 User Profile
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2, overflow: 'auto' }}>
                    <pre>{JSON.stringify(user, null, 2)}</pre>
                  </Paper>
                  
                  <Typography variant="subtitle1" gutterBottom>
                    User Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Name:</strong> {user.name}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Email:</strong> {user.email}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Email Verified:</strong> {user.email_verified ? 'Yes' : 'No'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Auth0 ID:</strong> {user.sub}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Session Details
                  </Typography>
                  <Button 
                    variant="outlined" 
                    onClick={fetchSession} 
                    disabled={sessionLoading}
                    sx={{ mb: 2 }}
                  >
                    {sessionLoading ? <CircularProgress size={24} /> : 'Refresh Session Data'}
                  </Button>
                  
                  {sessionError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Session Error: {sessionError}
                    </Alert>
                  )}
                  
                  {sessionData && (
                    <Paper variant="outlined" sx={{ p: 2, overflow: 'auto', maxHeight: 300 }}>
                      <pre>{JSON.stringify(sessionData, null, 2)}</pre>
                    </Paper>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Backend Authentication Test
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Test if the Auth0 token is being correctly validated by the backend and if the user is being synchronized with the database.
                  </Typography>
                  
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={testBackendAuth} 
                    disabled={backendLoading}
                    sx={{ mb: 2 }}
                  >
                    {backendLoading ? <CircularProgress size={24} color="inherit" /> : 'Test Backend Auth'}
                  </Button>
                  
                  {backendError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Backend Error: {backendError}
                    </Alert>
                  )}
                  
                  {backendResponse && (
                    <>
                      <Alert 
                        severity={backendResponse.status === 'success' ? 'success' : 'warning'} 
                        sx={{ mb: 2 }}
                      >
                        {backendResponse.message || 'Backend response received'}
                      </Alert>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle1" gutterBottom>
                            Auth0 User Information
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, overflow: 'auto', maxHeight: 300 }}>
                            <pre>{JSON.stringify(backendResponse.user, null, 2)}</pre>
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle1" gutterBottom>
                            Database User Information
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, overflow: 'auto', maxHeight: 300 }}>
                            <pre>{JSON.stringify(backendResponse.database_user, null, 2)}</pre>
                          </Paper>
                        </Grid>
                      </Grid>
                      
                      {backendResponse.role_source && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Role Source:
                          </Typography>
                          <Chip 
                            label={backendResponse.role_source}
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
    </Layout>
  );
} 