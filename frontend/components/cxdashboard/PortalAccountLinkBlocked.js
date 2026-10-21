import { FaPhone } from 'react-icons/fa';
import {
  MARKETING_PHONE_DISPLAY,
  MARKETING_PHONE_TEL,
} from '../../constants/marketingSiteContent';

export default function PortalAccountLinkBlocked({ detail, onRetry, retrying }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1525] p-6 md:p-8 text-center"
        role="alert"
      >
        <h1 className="text-white text-lg font-bold m-0">We couldn&apos;t connect your account</h1>
        <p className="text-gray-400 text-sm mt-3 mb-0 leading-relaxed">
          {detail || 'Your login is active, but we could not link it to a customer record.'}
        </p>
        <div className="flex flex-col gap-3 mt-6">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="w-full rounded-lg bg-[#00D4FF] text-[#0A0F1E] py-3 text-sm font-bold disabled:opacity-60"
          >
            {retrying ? 'Trying again…' : 'Try again'}
          </button>
          <a
            href={`tel:${MARKETING_PHONE_TEL}`}
            className="inline-flex items-center justify-center gap-2 text-cyan-400 text-sm font-semibold hover:text-cyan-300"
          >
            <FaPhone className="text-xs" />
            Call or text {MARKETING_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    </div>
  );
}
