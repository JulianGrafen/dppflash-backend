export interface PdfPageImage {
  readonly pageNumber: number;
  readonly dataUrl: string;
}

export interface PdfPageImageResult {
  readonly images: readonly PdfPageImage[];
  readonly pageCount: number;
}

const DEFAULT_MAX_PAGES = 3;
const DEFAULT_RENDER_SCALE = 1.6;

type CanvasFactory = (width: number, height: number) => {
  getContext(contextType: '2d'): unknown;
  toDataURL(mimeType: 'image/png'): string;
};

async function loadCreateCanvas(): Promise<CanvasFactory> {
  const canvasModule = await import('@napi-rs/canvas');
  return canvasModule.createCanvas as CanvasFactory;
}

export async function renderPdfPagesAsImages(
  buffer: Buffer,
  maxPages: number = DEFAULT_MAX_PAGES,
): Promise<PdfPageImageResult> {
  const createCanvas = await loadCreateCanvas();
  const pdfjsLib = (await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  )) as typeof import('pdfjs-dist');

  const pdf = await pdfjsLib
    .getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    })
    .promise;

  const pagesToRender = Math.min(pdf.numPages, maxPages);
  const images: PdfPageImage[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: DEFAULT_RENDER_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const canvasContext = canvas.getContext('2d');

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    images.push({
      pageNumber,
      dataUrl: canvas.toDataURL('image/png'),
    });
  }

  return {
    images,
    pageCount: pdf.numPages,
  };
}
