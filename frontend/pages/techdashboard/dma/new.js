import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import DmaFieldRecordForm from '../../../components/dma/DmaFieldRecordForm';
import { formValuesToPayload } from '../../../constants/dmaEquipmentOptions';
import { createDmaRepairRecord } from '../../../services/api/dmaApi';

function DmaNewRecordPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (values) => {
    setIsSaving(true);
    setError(null);
    try {
      const record = await createDmaRepairRecord(formValuesToPayload(values));
      router.push(`/techdashboard/dma/records/${record.id}`);
    } catch (err) {
      setError(err.message || 'Failed to save record');
      setIsSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Add Field Record | Repair Memory</title>
      </Head>

      <div className="px-4 py-6 max-w-2xl mx-auto pb-24">
        <div className="mb-6">
          <Link href="/techdashboard/dma" className="text-xs text-cyan-400 hover:text-cyan-300">
            ← Repair Memory
          </Link>
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90 mt-3 mb-1">
            Field record
          </p>
          <h1 className="text-2xl font-bold text-white">Add repair memory</h1>
          <p className="text-sm text-gray-400 mt-1">
            Technical repair details only — no customer name or address.
          </p>
        </div>

        <DmaFieldRecordForm onSubmit={handleSubmit} isSaving={isSaving} error={error} submitLabel="Save to repair memory" />
      </div>
    </>
  );
}

DmaNewRecordPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default DmaNewRecordPage;
