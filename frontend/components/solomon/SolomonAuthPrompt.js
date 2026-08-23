import Link from 'next/link';
import { solomonDiySignupUrl, solomonLoginUrl } from '../../utils/solomonAuthUrls';

/**
 * Sign-in / DIY signup choices for unauthenticated Solomon pages.
 */
export default function SolomonAuthPrompt({
  title = 'Sign in to continue',
  description = 'Create a free homeowner account or sign in with your existing Solomon access.',
  className = '',
}) {
  return (
    <div className={className}>
      <p className="text-gray-300 mb-4">{title}</p>
      {description ? <p className="text-sm text-gray-500 mb-4">{description}</p> : null}
      <div className="space-y-3">
        <a
          href={solomonDiySignupUrl()}
          className="block rounded-xl bg-[#0089B9] px-4 py-3 text-center font-medium"
        >
          Create homeowner account
        </a>
        <a href={solomonLoginUrl()} className="block rounded-xl border border-white/20 px-4 py-3 text-center">
          Sign in
        </a>
        <Link href="/solomon/signup" className="block text-center text-xs text-cyan-400 hover:text-cyan-300">
          Learn about homeowner access →
        </Link>
      </div>
    </div>
  );
}
