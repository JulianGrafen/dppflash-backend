import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

type PdfJsModule = typeof import('pdfjs-dist');

const PDFJS_WORKER_PATH = join(
  process.cwd(),
  'node_modules',
  'pdfjs-dist',
  'legacy',
  'build',
  'pdf.worker.mjs',
);

export function configurePdfJsForServer(pdfjsLib: PdfJsModule): void {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(PDFJS_WORKER_PATH).href;
}
