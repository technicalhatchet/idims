import SolomonListPage from '../../components/solomon/SolomonListPage';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { solomonDiySignupUrl, solomonLoginUrl, markSolomonDiySignupIntent } from '../../utils/solomonAuthUrls';
import {
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_PAGE_DESCRIPTION_CLASS,
  SOLOMON_SEARCH_BUTTON_CLASS,
} from '../../components/solomon/solomonListPageUi';

export default function SolomonSignupPage() {
  const { user } = useUser();
  const { canUseSolomon, retryDiyEnrollment, enrollmentState } = useSolomonAuth();

  const finishEnrollment = async () => {
    markSolomonDiySignupIntent();
    const ok = await retryDiyEnrollment();
    if (ok) window.location.href = '/solomon/start?welcome=1';
  };

  const secondaryButtonClass = `${SOLOMON_GLASS_PANEL_CLASS} block w-full py-4 text-center text-[var(--solomon-text-primary)]`;

  return (
    <SolomonListPage headTitle="Homeowner signup">
      <header className="mb-8">
        <img src="/solomon%20big.png" alt="Solomon" className="h-14 w-auto mb-4" />
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--solomon-text-primary)]">
          Diagnose your appliance
        </h1>
        <p className={SOLOMON_PAGE_DESCRIPTION_CLASS}>
          Free guided diagnostics for homeowners. Walk through symptoms step by step and save what you learned.
        </p>
      </header>

      <ul className="text-sm text-[var(--solomon-text-secondary)] space-y-2 mb-8 list-disc pl-5">
        <li>No work order or service appointment required</li>
        <li>Your notes stay private until reviewed for the repair knowledge pool</li>
        <li>Technicians and trainers use the same Solomon wizard with staff sign-in</li>
      </ul>

      <div className="space-y-3">
        {user && !canUseSolomon ? (
          <button
            type="button"
            onClick={finishEnrollment}
            disabled={enrollmentState === 'running'}
            className={`${SOLOMON_SEARCH_BUTTON_CLASS} disabled:opacity-60`}
          >
            {enrollmentState === 'running' ? 'Setting up…' : 'Finish homeowner account setup'}
          </button>
        ) : null}
        <a href={solomonDiySignupUrl()} className={SOLOMON_SEARCH_BUTTON_CLASS}>
          Create homeowner account
        </a>
        <a href={solomonLoginUrl()} className={secondaryButtonClass}>
          Already have an account? Sign in
        </a>
      </div>

      <p className="text-xs text-[var(--solomon-text-muted)] mt-8 text-center">
        Atomic Repair technicians — sign in with your staff account from the home page.
      </p>
    </SolomonListPage>
  );
}
