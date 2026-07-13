'use client';

import type { WizardFooterProps } from './types';

export default function WizardFooter({ children, className = '' }: WizardFooterProps) {
  return <div className={`pt-1 space-y-2 ${className}`}>{children}</div>;
}
