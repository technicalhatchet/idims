import { applianceCustomerSourceText } from '../../../constants/applianceSourceLabel';

export default function ApplianceSourceBadge({ appliance, className = '' }) {
  const text = applianceCustomerSourceText(appliance);
  if (!text) return null;

  const isCustomer = text === 'Added by you';

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${className}`}
      style={{
        borderColor: isCustomer ? 'rgba(34, 211, 238, 0.35)' : 'rgba(255, 255, 255, 0.12)',
        color: isCustomer ? '#67e8f9' : '#9ca3af',
        background: isCustomer ? 'rgba(34, 211, 238, 0.08)' : 'rgba(255, 255, 255, 0.04)',
      }}
    >
      {text}
    </span>
  );
}
