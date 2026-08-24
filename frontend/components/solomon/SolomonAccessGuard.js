import Link from 'next/link';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import SolomonAuthPrompt from './SolomonAuthPrompt';

/**
 * Gate Solomon pages — requires sign-in plus homeowner or staff role.
 */
export default function SolomonAccessGuard({
  children,
  promptTitle = 'Sign in to continue',
  className = '',
}) {
  const {
    isAuthenticated,
    isLoading,
    rolesLoading,
    rolesResolved,
    canUseSolomon,
    needsDiyEnrollment,
    enrollmentState,
    enrollmentError,
    retryDiyEnrollment,
    role,
  } = useSolomonAuth();

  if (isLoading || (isAuthenticated && rolesLoading && !rolesResolved)) {
    return (
      <div className={`flex justify-center py-16 ${className}`}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={className}>
        <SolomonAuthPrompt title={promptTitle} />
      </div>
    );
  }

  if (needsDiyEnrollment || enrollmentState === 'running') {
    return (
      <div className={`text-center py-12 ${className}`}>
        <LoadingSpinner />
        <p className="text-sm text-gray-400 mt-4">Setting up your homeowner account…</p>
      </div>
    );
  }

  if (enrollmentState === 'failed') {
    return (
      <div className={`rounded-xl border border-red-500/30 bg-red-500/5 p-6 ${className}`}>
        <p className="text-red-300 font-medium">Could not finish homeowner signup</p>
        <p className="text-sm text-gray-400 mt-2">{enrollmentError}</p>
        <button
          type="button"
          onClick={() => retryDiyEnrollment()}
          className="mt-4 rounded-lg bg-[#0089B9] px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!canUseSolomon) {
    const isClientAccount = role === 'client';
    return (
      <div className={`rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 ${className}`}>
        <p className="text-amber-200 font-medium">This account cannot use Solomon</p>
        <p className="text-sm text-gray-400 mt-2">
          {isClientAccount
            ? 'Client portal accounts cannot run standalone diagnostics. Create a homeowner account or sign in with staff access.'
            : 'Sign in with a homeowner or staff account, or complete homeowner signup below.'}
        </p>
        <div className="flex flex-col gap-3 mt-4">
          <Link href="/solomon/signup" className="text-sm text-cyan-400 hover:text-cyan-300">
            Create homeowner account →
          </Link>
          {isClientAccount ? (
            <Link href="/cxdashboard" className="text-sm text-gray-400 hover:text-gray-300">
              Go to client portal →
            </Link>
          ) : (
            <Link href="/techboard" className="text-sm text-gray-400 hover:text-gray-300">
              Go to tech dashboard →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return children;
}
