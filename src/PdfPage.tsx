import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';

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
  const [autoScale, setAutoScale] = useState(1);
  const scale = settings.auto ? autoScale : settings.scale / 100;
  const layoutWidth = settings.enabled ? availableWidth / scale : 794;
  const fits = height * scale <= availableHeight + .1;
  const contentKey = JSON.stringify(React.isValidElement(children) ? children.props : null);
  useLayoutEffect(() => {
    if (!settings.enabled || !settings.auto) return;
    const container = content.current;
    const article = container?.querySelector('article');
    if (!container || !article) return;
    // Reflow at each candidate width; do not shrink an already laid-out page.
    const measure = (candidate: number) => {
      container.style.width = `${availableWidth / candidate}px`;
      return Math.max(article.scrollHeight, article.offsetHeight);
    };
    let best = 1;
    if (measure(1) > availableHeight) {
      let low = .01, high = 1;
      for (let i = 0; i < 14; i++) {
        const candidate = (low + high) / 2;
        if (measure(candidate) * candidate <= availableHeight - .5) low = candidate;
        else high = candidate;
      }
      best = low;
    }
    const nextHeight = measure(best);
    setAutoScale(best);
    setHeight(nextHeight);
  }, [contentKey, settings.enabled, settings.auto, availableWidth, availableHeight, height]);
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
    const actualScale = scale;
    const currentWidth = parseFloat(getComputedStyle(article).width);
    if (currentWidth * actualScale > availableWidth + .1 || currentHeight * actualScale > availableHeight + .1) throw new Error('内容超出一页，请降低缩放比例或点击“自动适配一页”');
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
    position.style.cssText = `position:absolute;left:${margin}px;top:${margin}px;width:${availableWidth}px;height:${currentHeight * actualScale}px;overflow:hidden;`;
    const scaled = document.createElement('div');
    scaled.style.cssText = `width:${currentWidth}px;zoom:${actualScale};`;
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
  } }), [settings, scale, availableWidth, availableHeight, margin]);
  return <div className={settings.enabled ? `pdf-page ${fits ? '' : 'pdf-overflow'}` : 'pdf-continuous'} style={settings.enabled ? { width: PAGE_WIDTH, height: PAGE_HEIGHT } : undefined}>
    <div ref={content} className="pdf-content" style={settings.enabled ? { position: 'absolute', left: margin, top: margin, width: layoutWidth, transform: `scale(${scale})`, transformOrigin: 'top left' } : undefined}>{children}</div>
  </div>;
});
