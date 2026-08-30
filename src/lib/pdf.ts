import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface Shot {
  src: string;
  ar: number;
  doc: string;
}

/**
 * PRD §7 장표 파이프라인.
 * SLD-1 — PDF를 업로드하면 페이지마다 노드가 생성된다.
 * SLD-2 — 렌더링 시 흰 바탕을 먼저 깔아야 한다. PDF 페이지는 배경이 투명해
 *         그대로 구우면 내용이 사라진다.
 */
export async function pdfToShots(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<Shot[]> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const shots: Shot[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(p, doc.numPages);
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 1400 / Math.max(1, base.width)) });
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(viewport.width);
    cv.height = Math.ceil(viewport.height);
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    // SLD-3 — 원본 비율을 유지한다(16:9·세로·4:3 모두)
    shots.push({ src: cv.toDataURL('image/jpeg', 0.8), ar: cv.width / cv.height, doc: file.name });
  }
  return shots;
}

export function imageToShot(file: File): Promise<Shot> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => {
      const src = fr.result as string;
      const img = new Image();
      img.onload = () =>
        resolve({ src, ar: img.naturalWidth / Math.max(1, img.naturalHeight), doc: file.name });
      img.onerror = () => resolve({ src, ar: 16 / 9, doc: file.name });
      img.src = src;
    };
    fr.readAsDataURL(file);
  });
}

/**
 * 파일 목록을 장표로 변환한다. 여러 개를 연속으로 올려도 순서가 이어진다(SLD-1).
 * PPT는 브라우저에서 렌더링할 수 없어 PDF 저장을 안내한다.
 */
export async function filesToShots(
  files: FileList | File[],
  notify: (msg: string) => void
): Promise<Shot[]> {
  const all = Array.from(files);
  if (all.some((f) => /\.pptx?$/i.test(f.name))) {
    notify('PPT는 PDF로 저장한 뒤 올려주세요');
  }
  const out: Shot[] = [];
  for (const f of all) {
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
      try {
        const shots = await pdfToShots(f, (p, t) => notify(`장표 변환 중 ${p}/${t}`));
        out.push(...shots);
      } catch {
        notify('PDF를 읽지 못했습니다');
      }
    } else if (f.type && f.type.startsWith('image')) {
      out.push(await imageToShot(f));
    }
  }
  return out;
}
