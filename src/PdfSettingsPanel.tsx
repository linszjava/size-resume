import { Button, Slider, Switch } from '@arco-design/web-react';
import { FileText } from 'lucide-react';
import type { PdfSettings, PdfMetrics } from './PdfPage';

export function PdfSettingsPanel({ settings, metrics, onChange }: { settings: PdfSettings; metrics: PdfMetrics; onChange: (value: Partial<PdfSettings>) => void }) {
  return <div className="form-card pdf-settings">
    <h3><FileText size={17}/>单页 PDF<Switch aria-label="整合为一页 PDF" checked={settings.enabled} onChange={enabled => onChange({ enabled })}/></h3>
    {settings.enabled && <>
      <label>页边距 <span>{settings.margin} mm</span></label>
      <Slider aria-label="PDF 页边距" min={0} max={20} step={1} value={settings.margin} onChange={value => onChange({ margin: value as number })}/>
      <label>内容缩放 <span>{Math.round(metrics.scale * 1000) / 10}%{settings.auto ? ' · 自动' : ''}</span></label>
      <Slider aria-label="PDF 内容缩放" min={10} max={100} step={1} value={Math.max(10, Math.round(metrics.scale * 100))} onChange={value => onChange({ auto: false, scale: value as number })}/>
      <Button long type="outline" onClick={() => onChange({ auto: true })}>自动适配一页</Button>
      <p className={`pdf-status ${metrics.fits ? '' : 'error'}`} role="status">{metrics.fits ? '当前内容可完整放入 1 页 A4' : '内容超出一页，请减小缩放或自动适配'}</p>
      {metrics.scale < .65 && <p className="custom-basics-help">缩放后文字较小，建议精简内容或保留多页。</p>}
      <p className="custom-basics-help">导出时选择 A4、缩放 100%，关闭浏览器页眉页脚。</p>
    </>}
  </div>;
}
