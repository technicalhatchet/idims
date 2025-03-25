// src/pages/quotes/[id]/index.js
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaEdit, FaFileInvoiceDollar, FaTrash, FaDownload } from 'react-icons/fa';
import DashboardLayout from '../../../components/layouts/DashboardLayout';
import QuoteDetails from '../../../components/quotes/QuoteDetails';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/FormElements';
import { useQuote } from '../../../hooks/useQuotes';
import { withPageAuthRequired } from '../../../utils/auth0-helpers';

function QuoteDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const { quote, isLoading, isError, error, deleteQuote } = useQuote(id);

  const handleDelete = async () => {
    try {
      await deleteQuote();
      router.push('/quotes');
    } catch (err) {
      console.error('Failed to delete quote:', err);
    }
  };

  if (isLoading || !id) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return <ErrorAlert message={error?.message || 'Failed to load quote'} />;
  }

  return (
    <>
      <Head>
        <title>{`Quote #${quote?.quoteNumber || id} | Service Business Management`}</title>
      </Head>

      <div className="px-4 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/quotes" className="text-blue-600 hover:text-blue-800">
              ← Back to Quotes
            </Link>
            <h1 className="text-2xl font-bold mt-2">
              Quote #{quote?.quoteNumber || id}
            </h1>
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <FaDownload className="mr-2" /> Print/PDF
            </Button>
            
            <Link href={`/quotes/${id}/edit`} passHref>
              <Button as="a" variant="outline">
                <FaEdit className="mr-2" /> Edit
              </Button>
            </Link>
            
            <Link href={`/quotes/${id}/convert`} passHref>
              <Button as="a" variant="primary">
                <FaFileInvoiceDollar className="mr-2" /> Convert to Job
              </Button>
            </Link>
            
            <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
              <FaTrash className="mr-2" /> Delete
            </Button>
          </div>
        </div>
        
        <QuoteDetails quote={quote} />
      </div>
      
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Quote"
      >
        <p className="mb-4">Are you sure you want to delete this quote? This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete Quote
          </Button>
        </div>
      </Modal>
    </>
  );
}

QuoteDetail.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withPageAuthRequired(QuoteDetail);