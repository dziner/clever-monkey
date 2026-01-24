const PDF_COMPRESSION_THRESHOLD_BYTES = 25 * 1024 * 1024;
const PDF_MAX_DIMENSION = 1600;
const PDF_JPEG_QUALITY = 0.8;

type PdfCompressionResult = {
  file: File;
  compressionApplied: boolean;
};

const canCompressPdf = () => {
  const pdfjsLib = (window as any).pdfjsLib;
  const jspdfModule = (window as any).jspdf;
  return Boolean(pdfjsLib?.getDocument && jspdfModule?.jsPDF);
};

export const maybeCompressPdf = async (file: File): Promise<PdfCompressionResult> => {
  if (file.type !== 'application/pdf') {
    return { file, compressionApplied: false };
  }

  if (file.size < PDF_COMPRESSION_THRESHOLD_BYTES) {
    return { file, compressionApplied: false };
  }

  if (!canCompressPdf()) {
    return { file, compressionApplied: false };
  }

  try {
    const pdfjsLib = (window as any).pdfjsLib;
    const { jsPDF } = (window as any).jspdf;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdfDoc = await loadingTask.promise;

    let outputPdf: any = null;

    for (let pageIndex = 1; pageIndex <= pdfDoc.numPages; pageIndex += 1) {
      const page = await pdfDoc.getPage(pageIndex);
      const baseViewport = page.getViewport({ scale: 1.0 });
      const maxDimension = Math.max(baseViewport.width, baseViewport.height);
      const scale = Math.min(1, PDF_MAX_DIMENSION / maxDimension);
      const renderViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return { file, compressionApplied: false };

      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: renderViewport,
        background: 'white',
      }).promise;

      const imageData = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);

      if (!outputPdf) {
        outputPdf = new jsPDF({
          orientation: baseViewport.width > baseViewport.height ? 'l' : 'p',
          unit: 'pt',
          format: [baseViewport.width, baseViewport.height],
        });
      } else {
        outputPdf.addPage([baseViewport.width, baseViewport.height], baseViewport.width > baseViewport.height ? 'l' : 'p');
      }

      outputPdf.addImage(imageData, 'JPEG', 0, 0, baseViewport.width, baseViewport.height, undefined, 'FAST');

      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }

    if (!outputPdf) {
      return { file, compressionApplied: false };
    }

    const compressedBlob = outputPdf.output('blob');
    const compressedFile = new File([compressedBlob], file.name, { type: 'application/pdf' });

    if (compressedFile.size >= file.size) {
      return { file, compressionApplied: false };
    }

    return { file: compressedFile, compressionApplied: true };
  } catch (error) {
    console.error('PDF compression failed:', error);
    return { file, compressionApplied: false };
  }
};
