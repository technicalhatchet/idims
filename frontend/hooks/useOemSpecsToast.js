import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  buildOemSpecsToastMessage,
  oemSpecsScopeKey,
} from '../components/diagnostics/knowledge/oemSpecsScope';
import { MIN_EQUIPMENT_MODEL_LENGTH_FOR_OEM_UI } from '../components/diagnostics/procedures/oemDiagnosticGating';

const DEBOUNCE_MS = 1200;

/**
 * Shows a one-time toast when make/model resolve OEM-specific measurement tolerances.
 * Skips the initial mount so reopening a saved diagnostic does not re-notify.
 */
export function useOemSpecsToast(measurementContext) {
  const lastShownKeyRef = useRef(null);
  const skipInitialRef = useRef(true);

  useEffect(() => {
    const templateId = measurementContext?.templateId;
    const make = measurementContext?.equipmentMake;
    const model = measurementContext?.equipmentModel;

    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      const initialKey = oemSpecsScopeKey(measurementContext);
      if (initialKey) lastShownKeyRef.current = initialKey;
      return undefined;
    }

    const modelText = String(model || '').trim();
    if (
      !templateId
      || !String(make || '').trim()
      || modelText.length < MIN_EQUIPMENT_MODEL_LENGTH_FOR_OEM_UI
    ) {
      return undefined;
    }

    const timer = setTimeout(() => {
      const scopeKey = oemSpecsScopeKey(measurementContext);
      if (!scopeKey || scopeKey === lastShownKeyRef.current) return;

      const message = buildOemSpecsToastMessage(measurementContext);
      if (!message) return;

      lastShownKeyRef.current = scopeKey;
      toast.success(message, {
        id: `oem-specs-${scopeKey}`,
        position: 'bottom-center',
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    measurementContext?.templateId,
    measurementContext?.equipmentMake,
    measurementContext?.equipmentModel,
  ]);
}
