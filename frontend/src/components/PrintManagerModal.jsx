import React, { useState, useEffect, useRef } from 'react';
import { Printer, RefreshCw, CheckCircle, AlertTriangle, Clock, X, RotateCcw, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function PrintManagerModal({ isOpen, onClose, socket }) {
  const { apiFetch } = useAuth();
  const printingJobsRef = useRef(new Set());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'pending', 'printed', 'failed'

  const isMobile = typeof window !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
    if (isMobile) return false;
    const saved = localStorage.getItem('server_auto_print');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleAutoPrint = (checked) => {
    setAutoPrintEnabled(checked);
    localStorage.setItem('server_auto_print', String(checked));
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/print-jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);

        if (autoPrintEnabled && !isMobile) {
          data
            .filter((job) => job.status === 'pending')
            .forEach((job) => executePrint(job));
        }
      }
    } catch (err) {
      console.error('Erro ao buscar fila de impressão:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);

    return () => clearInterval(interval);
  }, [isOpen, autoPrintEnabled, isMobile]);

  // Listen to socket events in real time
  useEffect(() => {
    if (!socket) return;

    const handleNewJob = (job) => {
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
      
      // Auto-trigger printing ONLY on desktop server browser (never on mobile phones)
      if (autoPrintEnabled && !isMobile) {
        executePrint(job);
      }
    };

    const handleStatusChanged = (updatedJob) => {
      setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? { ...j, ...updatedJob } : j)));
    };

    socket.on('new_print_job', handleNewJob);
    socket.on('print_job_status_changed', handleStatusChanged);

    return () => {
      socket.off('new_print_job', handleNewJob);
      socket.off('print_job_status_changed', handleStatusChanged);
    };
  }, [socket, autoPrintEnabled, isMobile]);

  const executePrint = async (job) => {
    if (printingJobsRef.current.has(job.id)) return;
    printingJobsRef.current.add(job.id);

    try {
      // Create off-screen print element
      const printWindow = document.createElement('iframe');
      printWindow.style.position = 'absolute';
      printWindow.style.top = '-9999px';
      printWindow.style.left = '-9999px';
      document.body.appendChild(printWindow);

      const itemsHtml = (job.items || [])
        .map(
          (item) => `
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">
            ${item.quantity}x ${item.name}
            ${item.notes ? `<div style="font-size: 11px; font-weight: normal; font-style: italic; margin-left: 10px; color: #444;">Obs: ${item.notes}</div>` : ''}
          </div>
        `
        )
        .join('');

      const is58mm = configuredPaperWidth === '58mm';
      const printWidth = is58mm ? '48mm' : '72mm';
      const cutSpacing = is58mm ? '14mm' : '20mm';

      const doc = printWindow.contentDocument || printWindow.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: auto; margin: 0mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { 
                font-family: 'Courier New', Courier, monospace; 
                width: ${printWidth}; 
                padding: 2mm 1mm ${cutSpacing} 1mm; 
                color: #000; 
                margin: 0 auto; 
                -webkit-font-smoothing: antialiased;
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
              .title { font-size: 16px; font-weight: 900; text-transform: uppercase; }
              .sub { font-size: 14px; font-weight: 900; margin-top: 2px; }
              .footer { border-top: 1px dashed #000; margin-top: 8px; padding-top: 4px; text-align: center; font-size: 11px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">*** ${job.destination?.toUpperCase()} ***</div>
              <div class="sub">MESA ${job.table_number || '?'}</div>
              <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">${new Date(job.created_at || Date.now()).toLocaleTimeString('pt-BR')}</div>
            </div>
            ${itemsHtml}
            <div class="footer">
              PEDIDO #${job.order_id || job.id} | MENU CHEF
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(async () => {
        try {
          printWindow.contentWindow.focus();
          printWindow.contentWindow.print();
          document.body.removeChild(printWindow);

          // Update status to printed
          await apiFetch(`/api/print-jobs/${job.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'printed' }),
          });
          printingJobsRef.current.delete(job.id);
        } catch (e) {
          console.error('Falha ao imprimir job:', e);
          await apiFetch(`/api/print-jobs/${job.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'failed', error_message: e.message }),
          });
          printingJobsRef.current.delete(job.id);
        }
      }, 500);
    } catch (err) {
      console.error('Erro na execução da impressão:', err);
      printingJobsRef.current.delete(job.id);
    }
  };

  const handleReprint = async (jobId) => {
    try {
      const res = await apiFetch(`/api/print-jobs/${jobId}/reprint`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          executePrint(data.job);
        }
      }
    } catch (err) {
      console.error('Erro ao reenviar impressão:', err);
    }
  };

  if (!isOpen) return null;

  const filteredJobs = jobs.filter((job) => {
    if (activeFilter === 'pending') return job.status === 'pending';
    if (activeFilter === 'printed') return job.status === 'printed';
    if (activeFilter === 'failed') return job.status === 'failed';
    return true;
  });

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="relative bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-[9999] px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs rounded-full shadow-2xl flex items-center gap-2 transition-colors"
          title="Fechar"
          aria-label="Fechar gerenciador de impressão"
        >
          <span>Fechar</span>
          <X className="h-5 w-5" />
        </button>
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-dark-border flex items-center justify-between bg-zinc-50 dark:bg-dark-element">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-brand-500/10 text-brand-500 rounded-xl flex items-center justify-center">
              <Printer className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">
                  Gerenciador de Impressão
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-full flex items-center space-x-1">
                  <Activity className="h-3 w-3 animate-pulse" />
                  <span>Servidor Ativo</span>
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-dark-muted mt-0.5">
                Monitoramento em tempo real de comandas enviadas pelo celular e computador
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchJobs}
              className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-dark-muted dark:hover:text-dark-text rounded-xl hover:bg-zinc-200 dark:hover:bg-dark-border transition-colors"
              title="Atualizar lista"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

          </div>
        </div>

        {/* Status stats & filters */}
        <div className="p-4 border-b border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                activeFilter === 'all'
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'bg-zinc-100 dark:bg-dark-element text-zinc-600 dark:text-dark-muted hover:bg-zinc-200'
              }`}
            >
              Todos ({jobs.length})
            </button>
            <button
              onClick={() => setActiveFilter('pending')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all ${
                activeFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pendentes ({pendingCount})</span>
            </button>
            <button
              onClick={() => setActiveFilter('printed')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all ${
                activeFilter === 'printed'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Impressos ({jobs.length - pendingCount - failedCount})</span>
            </button>
            {failedCount > 0 && (
              <button
                onClick={() => setActiveFilter('failed')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all ${
                  activeFilter === 'failed'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Erros ({failedCount})</span>
              </button>
            )}
          </div>

          <label className="flex items-center space-x-2 text-xs font-bold text-zinc-700 dark:text-dark-text cursor-pointer">
            <input
              type="checkbox"
              checked={autoPrintEnabled}
              onChange={(e) => handleToggleAutoPrint(e.target.checked)}
              className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500"
            />
            <span>Impressão Automática neste Computador</span>
          </label>
        </div>

        {/* Jobs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredJobs.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 dark:text-dark-muted">
              <Printer className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-sm">Nenhum trabalho de impressão encontrado.</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-300 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-extrabold text-[11px] uppercase tracking-wider ${
                        job.destination === 'cozinha'
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {job.destination}
                    </span>

                    <span className="font-bold text-sm text-zinc-900 dark:text-dark-text">
                      Mesa #{job.table_number || '?'}
                    </span>

                    <span className="text-xs text-zinc-400">
                      (Pedido #{job.order_id})
                    </span>

                    {/* Status badge */}
                    {job.status === 'printed' && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 font-bold text-xs rounded-full flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>Impresso</span>
                      </span>
                    )}
                    {job.status === 'pending' && (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 font-bold text-xs rounded-full flex items-center space-x-1 animate-pulse">
                        <Clock className="h-3 w-3" />
                        <span>Aguardando</span>
                      </span>
                    )}
                    {job.status === 'failed' && (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-600 font-bold text-xs rounded-full flex items-center space-x-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Falha</span>
                      </span>
                    )}
                  </div>

                  {/* Items list summary */}
                  <div className="text-xs text-zinc-600 dark:text-dark-muted font-medium pt-1">
                    {(job.items || []).map((it, idx) => (
                      <span key={idx} className="mr-2">
                        • <strong>{it.quantity}x</strong> {it.name}
                        {it.notes ? <em className="text-zinc-500 ml-1">({it.notes})</em> : ''}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-zinc-400">
                    Enviado em: {new Date(job.created_at || Date.now()).toLocaleTimeString('pt-BR')}
                    {job.printer_name ? ` • Impressora: ${job.printer_name}` : ''}
                  </p>

                  {job.error_message && (
                    <p className="text-xs text-red-500 font-semibold">
                      Erro: {job.error_message}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleReprint(job.id)}
                    className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reimprimir</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
