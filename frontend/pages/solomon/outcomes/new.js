import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonMobileShell from '../../../components/solomon/SolomonMobileShell';
import SolomonWizardHeader, { SolomonWizardBackLink } from '../../../components/solomon/SolomonWizardHeader';
import DmaFieldRecordForm from '../../../components/dma/DmaFieldRecordForm';
import {
  createDmaRepairRecord,
  getDmaStandaloneDiagnostic,
  linkDmaDiagnosticToOutcome,
} from '../../../services/api/dmaApi';
import { formValuesToPayload, EMPTY_FIELD_RECORD } from '../../../constants/dmaEquipmentOptions';
import { complaintFromPayload, templateIdToEquipmentSubtype } from '../../../utils/standaloneDiagnostic';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { solomonCopy } from '../../../utils/solomonDiyCopy';

export default function SolomonNewOutcomePage() {
  const router = useRouter();
  const { isDiyer } = useSolomonAuth();
  const copy = (key) => solomonCopy(isDiyer, key);
  const diagnosticId = typeof router.query.diagnostic_id === 'string' ? router.query.diagnostic_id : null;
  const [initialValues, setInitialValues] = useState(EMPTY_FIELD_RECORD);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!diagnosticId) return undefined;
    let cancelled = false;
    getDmaStandaloneDiagnostic(diagnosticId)
      .then((diag) => {
        if (cancelled) return;
        const payload = diag.payload || {};
        setInitialValues({
          ...EMPTY_FIELD_RECORD,
          equipment_make: diag.equipment_make || '',
          equipment_model: diag.equipment_model || '',
          equipment_subtype: diag.equipment_subtype || templateIdToEquipmentSubtype(payload.templateId) || '',
          customer_complaint: diag.customer_complaint || complaintFromPayload(payload) || '',
          outcome_confidence: isDiyer ? 'unconfirmed' : '',
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [diagnosticId]);

  const handleSubmit = async (values) => {
    setIsSaving(true);
    setError(null);
    try {
      const record = await createDmaRepairRecord(formValuesToPayload(values));
      if (diagnosticId) {
        await linkDmaDiagnosticToOutcome(diagnosticId, record.id);
      }
      router.push(`/solomon/outcomes/${record.id}`);
    } catch (err) {
      setError(err.message || 'Failed to save outcome');
      setIsSaving(false);
    }
  };

  return (
    <>
      <SolomonHead title={copy('outcomeNew')} />
      <SolomonMobileShell
        header={
          <SolomonWizardHeader left={<SolomonWizardBackLink href="/solomon/outcomes" />} />
        }
      >
        <div className="space-y-4 pb-6">
          <h1 className="text-xl font-semibold">{copy('outcomeOne')}</h1>
          {diagnosticId ? (
            <p className="text-sm text-gray-400">Will link to your diagnostic after save.</p>
          ) : null}
          {isDiyer ? (
            <p className="text-sm text-amber-300/90">
              Your repair notes stay private until our team reviews them for the shared knowledge pool.
            </p>
          ) : null}

          <DmaFieldRecordForm
            initialValues={initialValues}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            error={error}
            submitLabel={copy('saveOutcome')}
            variant={isDiyer ? 'diy' : 'default'}
          />
        </div>
      </SolomonMobileShell>
    </>
  );
}
