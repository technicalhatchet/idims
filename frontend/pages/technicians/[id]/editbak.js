import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import TechnicianForm from '@/components/technicians/TechnicianForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import { useTechnician } from '@/hooks/useTechnicians';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

function EditTechnician() {
  const router = useRouter();
  const { id } = router.query;
  
  // Check authorization (only managers and admins)
  useAuthRedirect({ allowedRoles: ['admin', 'manager'] });

  // Fetch technician details
  const { 
    data: technician