import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SolomonHead from '../../../components/solomon/SolomonHead';
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
      <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-6 max-w-lg mx-auto pb-24">
        <Link href="/solomon/outcomes" className="text-xs text-cyan-400 hover:text-cyan-300">
          ← {copy('outcomesTitle')}
        </Link>
        <h1 className="text-2xl font-semibold mt-3 mb-1">{copy('outcomeOne')}</h1>
        {diagnosticId ? (
          <p className="text-sm text-gray-400 mb-4">Will link to your diagnostic after save.</p>
        ) : null}
        {isDiyer ? (
          <p className="text-sm text-amber-300/90 mb-4">
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
      </main>
    </>
  );
}
