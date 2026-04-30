import React from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/Button';
import { API_URL } from '../lib/api';

/**
 * Botão de export com dropdown CSV / XLSX.
 *
 * Props:
 *   csvUrl, xlsxUrl  - paths absolutos (ex: '/api/admin/invoices/export.csv')
 *   filename         - sufixo opcional só pra UX no toast
 *   variant          - mesmo do Button
 *   className, size, label
 *
 * Faz fetch autenticado, salva blob como download. Funciona em qualquer ambiente.
 */
export default function ExportButton({
  csvUrl,
  xlsxUrl,
  filename = 'export',
  label = 'Exportar',
  variant = 'outline',
  size,
  testId = 'export-btn',
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const download = async (path, ext) => {
    setOpen(false);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${ext.toUpperCase()} exportado`);
    } catch (e) {
      toast.error(`Falha ao exportar ${ext.toUpperCase()}: ${e.message || ''}`);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <Button variant={variant} size={size} onClick={() => setOpen(!open)} data-testid={testId}>
        <Download className="w-4 h-4" /> {label} <ChevronDown className="w-3 h-3 ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-30 min-w-[140px] overflow-hidden" data-testid={`${testId}-menu`}>
          {csvUrl && (
            <button
              onClick={() => download(csvUrl, 'csv')}
              className="w-full text-left px-4 py-2 text-sm hover:bg-bg-secondary transition flex items-center gap-2"
              data-testid={`${testId}-csv`}
            >
              <span className="font-mono text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">CSV</span>
              Comma-separated
            </button>
          )}
          {xlsxUrl && (
            <button
              onClick={() => download(xlsxUrl, 'xlsx')}
              className="w-full text-left px-4 py-2 text-sm hover:bg-bg-secondary transition flex items-center gap-2"
              data-testid={`${testId}-xlsx`}
            >
              <span className="font-mono text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">XLSX</span>
              Excel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
