import { useRouter } from 'next/router';
import { useSolomonTheme } from './useSolomonTheme';
import { shouldShowSolomonBottomNav } from '../components/solomon/solomonNavigation';

/** True when Professional bottom tab bar should render on the current route. */
export default function useSolomonBottomNavVisible() {
  const router = useRouter();
  const { isProfessional } = useSolomonTheme();
  return shouldShowSolomonBottomNav(router.pathname, { isProfessional });
}
