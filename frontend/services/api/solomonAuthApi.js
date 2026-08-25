import { apiClient } from '../../utils/api-client';

export async function completeDiySignup() {
  return apiClient('auth/auth/complete-diy-signup', { method: 'POST' });
}
