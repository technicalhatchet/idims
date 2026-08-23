import Link from 'next/link';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonPageMain from '../../components/solomon/SolomonPageMain';
import { solomonDiySignupUrl, solomonLoginUrl } from '../../utils/solomonAuthUrls';

export default function SolomonSignupPage() {
  return (
    <>
      <SolomonHead title="Homeowner signup" />
      <SolomonPageMain>
        <Link href="/solomon" className="text-xs text-cyan-400 hover:text-cyan-300">← Solomon</Link>

        <header className="mt-6 mb-8">
          <img src="/solomon%20big.png" alt="Solomon" className="h-14 w-auto mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight">Diagnose your appliance</h1>
          <p className="text-sm text-white/70 mt-2">
            Free guided diagnostics for homeowners. Walk through symptoms step by step and save what you learned.
          </p>
        </header>

        <ul className="text-sm text-gray-400 space-y-2 mb-8 list-disc pl-5">
          <li>No work order or service appointment required</li>
          <li>Your notes stay private until reviewed for the repair knowledge pool</li>
          <li>Technicians and trainers use the same Solomon wizard with staff sign-in</li>
        </ul>

        <div className="space-y-3">
          <a
            href={solomonDiySignupUrl()}
            className="block rounded-xl bg-[#0089B9] px-4 py-4 text-center font-medium"
          >
            Create homeowner account
          </a>
          <a href={solomonLoginUrl()} className="block rounded-xl border border-white/20 px-4 py-4 text-center">
            Already have an account? Sign in
          </a>
        </div>

        <p className="text-xs text-white/40 mt-8 text-center">
          Atomic Repair technicians — sign in with your staff account from the home page.
        </p>
      </SolomonPageMain>
    </>
  );
}
