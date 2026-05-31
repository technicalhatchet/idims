import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FaChevronDown, FaChevronUp, FaEye } from 'react-icons/fa';
import {
  fetchWorkOrderPhotoBlob,
  getWorkOrderPhotos,
} from '../../services/api/workOrderPhotosApi';
import ReceiptViewerModal from './ReceiptViewerModal';
import WorkOrderPhotoUploadSheet from './WorkOrderPhotoUploadSheet';

export default function WorkOrderPhotosSection({
  workOrderId,
  variant = 'mobile',
  refreshKey = 0,
  uploadOpen: uploadOpenProp,
  onUploadOpenChange,
}) {
  const isMobile = variant === 'mobile';
  const [internalUploadOpen, setInternalUploadOpen] = useState(false);
  const uploadOpen = onUploadOpenChange != null ? uploadOpenProp : internalUploadOpen;
  const setUploadOpen = onUploadOpenChange ?? setInternalUploadOpen;
  const [localRefresh, setLocalRefresh] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [viewer, setViewer] = useState({
    open: false,
    loading: false,
    error: null,
    blobUrl: null,
    mimeType: null,
    filename: null,
    driveLink: null,
  });

  const load = useCallback(async () => {
    if (!workOrderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkOrderPhotos(workOrderId);
      setPhotos(data?.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load photos');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    load();
  }, [load, refreshKey, localRefresh]);

  const closeViewer = () => {
    setViewer((prev) => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return {
        open: false,
        loading: false,
        error: null,
        blobUrl: null,
        mimeType: null,
        filename: null,
        driveLink: null,
      };
    });
  };

  const handleOpenPhoto = async (photo) => {
    setError(null);
    setViewer((prev) => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return {
        open: true,
        loading: true,
        error: null,
        blobUrl: null,
        mimeType: null,
        filename: photo.description || photo.filename,
        driveLink: photo.drive_web_view_link || null,
      };
    });
    try {
      const { blobUrl, mimeType } = await fetchWorkOrderPhotoBlob(photo.id);
      setViewer((prev) => ({
        ...prev,
        loading: false,
        blobUrl,
        mimeType,
      }));
    } catch (err) {
      setViewer((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Could not open photo',
      }));
    }
  };

  const formatPhotoDate = (value) => {
    if (!value) return '';
    const dateStr = value.endsWith('Z') ? value : `${value}Z`;
    return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
  };

  if (loading && photos.length === 0) {
    return (
      <p className={`text-sm mt-4 ${isMobile ? 'text-gray-500' : 'text-gray-400'}`}>
        Loading photos…
      </p>
    );
  }

  return (
    <>
      <div className={`mt-4 rounded-xl overflow-hidden ${isMobile ? 'border border-cyan-500/20 bg-[#0D1525]' : 'border border-gray-200 bg-gray-50'}`}>
        <button
          type="button"
          onClick={() => setSectionOpen((o) => !o)}
          className={`w-full flex items-center justify-between px-4 py-3 text-left ${isMobile ? 'hover:bg-cyan-950/30' : 'hover:bg-gray-100'}`}
        >
          <span className={`text-sm font-semibold ${isMobile ? 'text-cyan-300' : 'text-gray-900'}`}>
            Photos ({photos.length})
          </span>
          {sectionOpen ? (
            <FaChevronUp className={isMobile ? 'text-cyan-400' : 'text-gray-500'} />
          ) : (
            <FaChevronDown className={isMobile ? 'text-cyan-400' : 'text-gray-500'} />
          )}
        </button>

        {sectionOpen && (
          <div className={`px-4 pb-4 space-y-2 border-t ${isMobile ? 'border-cyan-500/15' : 'border-gray-200'}`}>
            {onUploadOpenChange == null && (
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className={`w-full h-9 rounded-lg text-xs font-semibold uppercase tracking-wide ${
                  isMobile
                    ? 'border border-cyan-500/35 text-cyan-300'
                    : 'border border-gray-300 text-gray-700 bg-white'
                }`}
              >
                Add photo
              </button>
            )}
            {error && <p className="text-sm text-red-400 pt-3">{error}</p>}
            {!photos.length && !error && (
              <p className={`text-sm py-3 ${isMobile ? 'text-gray-500' : 'text-gray-400'}`}>
                No photos yet. Tap Photo below to add one.
              </p>
            )}
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => handleOpenPhoto(photo)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition active:scale-[0.99] ${
                  isMobile
                    ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isMobile ? 'text-cyan-300' : 'text-blue-600'}`}>
                      {photo.description || 'Photo'}
                    </p>
                    <div className={`mt-1 flex flex-wrap gap-x-3 text-xs ${isMobile ? 'text-gray-500' : 'text-gray-500'}`}>
                      <span>{photo.user_name || 'Unknown'}</span>
                      <span>{formatPhotoDate(photo.created_at)}</span>
                    </div>
                  </div>
                  <FaEye className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isMobile ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <ReceiptViewerModal
        open={viewer.open}
        onClose={closeViewer}
        filename={viewer.filename}
        blobUrl={viewer.blobUrl}
        mimeType={viewer.mimeType}
        driveLink={viewer.driveLink}
        loading={viewer.loading}
        error={viewer.error}
        isMobile={isMobile}
      />

      <WorkOrderPhotoUploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        workOrderId={workOrderId}
        variant={variant}
        onSuccess={() => setLocalRefresh((k) => k + 1)}
      />
    </>
  );
}
