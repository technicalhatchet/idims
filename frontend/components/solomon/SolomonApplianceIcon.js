'use client';

import ApplianceIcon from '../ui/ApplianceIcon';
import useSolomonTheme from '../../hooks/useSolomonTheme';

/** ApplianceIcon with Solomon interface style — muted strokes in Professional. */
export default function SolomonApplianceIcon(props) {
  const { isProfessional } = useSolomonTheme();
  const { glow = 'subtle', ...rest } = props;

  return (
    <ApplianceIcon
      {...rest}
      variant={isProfessional ? 'professional' : 'signature'}
      glow={isProfessional ? 'none' : glow}
    />
  );
}
