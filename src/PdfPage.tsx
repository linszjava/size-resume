import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type PdfSettings = { enabled: boolean; auto: boolean; scale: number; margin: number };
export const defaultPdfSettings: PdfSettings = { enabled: false, auto: true, scale: 100, margin: 6 };
export type PdfMetrics = { scale: number; fits: boolean };
export type PdfPageHandle = { print: () => Promise<void> };
const PAGE_WIDTH = 210 * 96 / 25.4;
const PAGE_HEIGHT = 297 * 96 / 25.4;

// Freeze the actual rendered template so printing cannot apply a different layout.
function cloneAppearance(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  originals.forEach((node, index) => {
    const style = getComputedStyle(node);
    const target = copies[index] as HTMLElement | SVGElement;
    for (const property of Array.from(style)) target.style.setProperty(property, style.getPropertyValue(property), 'important');
    target.style.setProperty('print-color-adjust', 'exact');
    target.style.setProperty('-webkit-print-color-adjust', 'exact');
    // Materialize template ornaments that normally come from pseudo-elements.
    if (node instanceof HTMLElement) for (const pseudo of ['::before', '::after']) {
      const decoration = getComputedStyle(node, pseudo);
      if (decoration.content === 'none' || decoration.content === 'normal' || decoration.display === 'none') continue;
      const ornament = document.createElement('span');
      for (const property of Array.from(decoration)) ornament.style.setProperty(property, decoration.getPropertyValue(property), 'important');
      ornament.textContent = decoration.content.replace(/^['"]|['"]$/g, '');
      if (pseudo === '::before') target.prepend(ornament); else target.append(ornament);
    }
  });
  clone.style.setProperty('box-shadow', 'none', 'important');
  clone.style.setProperty('margin', '0', 'important');
  return clone;
}

export const PdfPage = forwardRef<PdfPageHandle, { settings: PdfSettings; children: React.ReactNode; onMetrics: (metrics: PdfMetrics) => void }>(function PdfPage({ settings, children, onMetrics }, ref) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(1123);
  const margin = settings.margin * 96 / 25.4;
  const availableWidth = PAGE_WIDTH - margin * 2;
  const availableHeight = PAGE_HEIGHT - margin * 2;
  const fitScale = Math.min(1, availableWidth / 794, availableHeight / height);
  const scale = settings.auto ? fitScale : settings.scale / 100;
  const fits = 794 * scale <= availableWidth + .1 && height * scale <= availableHeight + .1;
  useEffect(() => {
    const article = content.current?.querySelector('article');
    if (!article) return;
    const observer = new ResizeObserver(() => setHeight(Math.max(article.scrollHeight, (article as HTMLElement).offsetHeight)));
    observer.observe(article);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { onMetrics({ scale, fits }); }, [scale, fits, onMetrics]);
  useImperativeHandle(ref, () => ({ print: async () => {
    await document.fonts.ready;
    const article = content.current?.querySelector('article');
    if (!article) throw new Error('预览尚未准备好，请重试');
    await Promise.all(Array.from(article.querySelectorAll('img')).map(img => img.decode().catch(() => {})));
    const currentHeight = Math.max(article.scrollHeight, article.offsetHeight);
    const actualScale = settings.auto ? Math.min(1, availableWidth / 794, availableHeight / currentHeight) : settings.scale / 100;
    if (794 * actualScale > availableWidth + .1 || currentHeight * actualScale > availableHeight + .1) throw new Error('内容超出一页，请降低缩放比例或点击“自动适配一页”');
    const clone = cloneAppearance(article);
    document.getElementById('single-page-print')?.remove();
    const printRoot = document.createElement('div');
    printRoot.id = 'single-page-print';
    printRoot.setAttribute('aria-hidden', 'true');
    const style = document.createElement('style');
    style.textContent = `
      #single-page-print { display: none; }
      @media print {
        @page { size: A4 portrait; margin: 0; }
        html, body { width: 210mm !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
        body > :not(#single-page-print) { display: none !important; }
        #single-page-print { display: block !important; position: relative !important; width: 210mm !important; height: 296.9mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: white !important; break-inside: avoid !important; }
      }
    `;
    printRoot.appendChild(style);
    const position = document.createElement('div');
    // zoom participates in layout; transform only changes painting and can
    // leave the original full-height box spanning additional printed pages.
    position.style.cssText = `position:absolute;left:${margin + (availableWidth - 794 * actualScale) / 2}px;top:${margin}px;width:${794 * actualScale}px;height:${currentHeight * actualScale}px;overflow:hidden;`;
    const scaled = document.createElement('div');
    scaled.style.cssText = `width:794px;zoom:${actualScale};`;
    // Existing multi-page print rules must not paginate or restyle the clone.
    for (const node of [clone, ...clone.querySelectorAll('*')]) {
      const element = node as HTMLElement;
      element.style.setProperty('break-before', 'auto', 'important');
      element.style.setProperty('break-after', 'auto', 'important');
      element.style.setProperty('break-inside', 'auto', 'important');
    }
    scaled.appendChild(clone); position.appendChild(scaled); printRoot.appendChild(position);
    document.body.appendChild(printRoot);
    const cleanup = () => { printRoot.remove(); window.removeEventListener('afterprint', cleanup); };
    try {
      await Promise.all(Array.from(printRoot.querySelectorAll('img')).map(img => img.decode().catch(() => {})));
      window.addEventListener('afterprint', cleanup, { once: true });
      window.print();
    } catch (error) { cleanup(); throw error; }
  } }), [settings, availableWidth, availableHeight, margin]);
  return <div className={settings.enabled ? `pdf-page ${fits ? '' : 'pdf-overflow'}` : 'pdf-continuous'} style={settings.enabled ? { width: PAGE_WIDTH, height: PAGE_HEIGHT } : undefined}>
    <div ref={content} className="pdf-content" style={settings.enabled ? { position: 'absolute', left: margin + Math.max(0, (availableWidth - 794 * scale) / 2), top: margin, width: 794, transform: `scale(${scale})`, transformOrigin: 'top left' } : undefined}>{children}</div>
  </div>;
});
