import { useEffect, useRef, useState } from 'react';

let workerConfigured = false;

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerConfigured && typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    workerConfigured = true;
  }
  return pdfjs;
}

function isStale(renderId, renderIdRef, cancelled) {
  return cancelled || renderId !== renderIdRef.current;
}

export default function PortalPdfViewer({ blobUrl, zoom = 100 }) {
  const canvasHostRef = useRef(null);
  const pdfDocRef = useRef(null);
  const loadIdRef = useRef(0);
  const renderIdRef = useRef(0);
  const widthRef = useRef(0);
  const [error, setError] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [docVersion, setDocVersion] = useState(0);
  const [layoutTick, setLayoutTick] = useState(0);

  // Load the PDF document once per blob URL.
  useEffect(() => {
    if (!blobUrl) return undefined;

    const loadId = ++loadIdRef.current;
    let cancelled = false;
    pdfDocRef.current = null;
    setInitialLoading(true);
    setError(null);
    setDocVersion(0);

    async function load() {
      try {
        const pdfjs = await getPdfjs();
        if (isStale(loadId, loadIdRef, cancelled)) return;

        const data = await fetch(blobUrl).then((res) => res.arrayBuffer());
        if (isStale(loadId, loadIdRef, cancelled)) return;

        const pdf = await pdfjs.getDocument({ data }).promise;
        if (isStale(loadId, loadIdRef, cancelled)) return;

        pdfDocRef.current = pdf;
        setDocVersion((v) => v + 1);
        setInitialLoading(false);
      } catch (err) {
        if (!isStale(loadId, loadIdRef, cancelled)) {
          setError(err?.message || 'Failed to load PDF');
          setInitialLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      pdfDocRef.current = null;
    };
  }, [blobUrl]);

  // Paint canvases when the document, zoom, or viewport width changes.
  useEffect(() => {
    const pdf = pdfDocRef.current;
    const host = canvasHostRef.current;
    if (!pdf || !host || docVersion === 0) return undefined;

    const renderId = ++renderIdRef.current;
    let cancelled = false;

    async function paint() {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (isStale(renderId, renderIdRef, cancelled)) return;

      const hostWidth = host.parentElement?.clientWidth ?? host.clientWidth;
      const containerWidth = Math.max((hostWidth || widthRef.current) - 8, 280);
      widthRef.current = containerWidth;

      try {
        const firstPage = await pdf.getPage(1);
        if (isStale(renderId, renderIdRef, cancelled)) return;

        const baseViewport = firstPage.getViewport({ scale: 1 });
        const fitScale = containerWidth / baseViewport.width;
        const scale = fitScale * (zoom / 100);

        const fragment = document.createDocumentFragment();

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          if (isStale(renderId, renderIdRef, cancelled)) return;

          const page = await pdf.getPage(pageNum);
          if (isStale(renderId, renderIdRef, cancelled)) return;

          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 12px';

          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (isStale(renderId, renderIdRef, cancelled)) return;

          fragment.appendChild(canvas);
        }

        if (isStale(renderId, renderIdRef, cancelled)) return;
        host.replaceChildren(fragment);
      } catch (err) {
        if (!isStale(renderId, renderIdRef, cancelled)) {
          setError(err?.message || 'Failed to render PDF');
        }
      }
    }

    paint();

    return () => {
      cancelled = true;
    };
  }, [docVersion, zoom, layoutTick]);

  // Re-fit when the window is resized — not when canvas height changes.
  useEffect(() => {
    if (docVersion === 0) return undefined;

    let timer;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const host = canvasHostRef.current;
        if (!host) return;

        const nextWidth = host.parentElement?.clientWidth ?? 0;
        if (nextWidth > 0 && Math.abs(nextWidth - widthRef.current) >= 8) {
          setLayoutTick((t) => t + 1);
        }
      }, 200);
    };

    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [docVersion]);

  return (
    <div className="relative w-full min-h-[200px]">
      {initialLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="p-6 text-center text-red-400 text-sm">{error}</div>
      )}
      <div className={`w-full py-2 px-1 ${initialLoading ? 'hidden' : ''}`}>
        <div ref={canvasHostRef} />
      </div>
    </div>
  );
}
