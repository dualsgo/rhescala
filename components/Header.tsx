
import React, { useState } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Icon } from './Icon';
import { Employee, MonthYear } from '../types';
import * as XLSX from 'xlsx';

const WEEKDAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

interface HeaderProps {
  currentView: 'dashboard' | 'team';
  onViewChange: (view: 'dashboard' | 'team') => void;
  currentMY: MonthYear;
  employees: Employee[];
  onImportClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  currentMY,
  employees,
  onImportClick,
}) => {
  const { showDialog } = useDialog();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const monthKey = `${currentMY.year}-${currentMY.month.toString().padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const dayLabels = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      return `${String(i + 1).padStart(2, '0')}\n${WEEKDAY_ABBR[date.getDay()]}`;
    });
    const header = ['Nome', 'Horário', ...dayLabels];
    const rows = employees.map(emp => {
      const row: (string | number)[] = [emp.name, emp.workPeriod];
      for (let i = 0; i < daysInMonth; i++) {
        const shift = (emp.shifts[monthKey] || [])[i] || 'F';
        if (['F', 'FF', 'FE', 'C'].includes(shift)) {
          row.push(shift);
        } else {
          const h = (emp.dailyHours[monthKey] || [])[i] || emp.workPeriod;
          row.push(h.split(' ')[0]);
        }
      }
      return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, ...Array(daysInMonth).fill({ wch: 6 })];
    ws['!rows'] = [{ hpt: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Escala');
    XLSX.writeFile(wb, `Escala_${monthKey}.xlsx`);
  };

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const monthName = months[currentMY.month];
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`Escala Operacional – ${monthName} ${currentMY.year}`, 40, 35);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 40, 48);
      doc.setTextColor(0, 0, 0);
      const head = [['Colaborador', 'Horário', ...Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(currentMY.year, currentMY.month, i + 1);
        return `${i + 1}\n${WEEKDAY_ABBR[date.getDay()]}`;
      })]];
      const body = employees.map(emp => {
        const shiftCells = Array.from({ length: daysInMonth }, (_, i) => {
          const s = (emp.shifts[monthKey] || [])[i] || 'F';
          if (['F', 'FF', 'FE', 'C'].includes(s)) return s;
          const h = (emp.dailyHours[monthKey] || [])[i] || emp.workPeriod;
          return h.split(' ')[0];
        });
        return [emp.name, emp.workPeriod.split(' ')[0], ...shiftCells];
      });
      (doc as any).autoTable({
        head, body, startY: 58,
        styles: { fontSize: 6, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold', fontSize: 6.5, minCellHeight: 28 },
        bodyStyles: { textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 80, halign: 'left' }, 1: { cellWidth: 38, halign: 'left' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index >= 2) {
            const val = data.cell.raw as string;
            if (val === 'F')  { data.cell.styles.fillColor = [253, 186, 116]; data.cell.styles.textColor = [154, 52, 18]; }
            if (val === 'FF') { data.cell.styles.fillColor = [254, 202, 202]; data.cell.styles.textColor = [153, 27, 27]; }
            if (val === 'FE') { data.cell.styles.fillColor = [221, 214, 254]; data.cell.styles.textColor = [76, 29, 149]; }
            if (val === 'C')  { data.cell.styles.fillColor = [204, 251, 241]; data.cell.styles.textColor = [15, 118, 110]; }
          }
        },
      });
      doc.save(`Escala_${monthKey}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      await showDialog({ type: 'alert', message: 'Erro ao gerar PDF. Verifique o console.' });
    }
  };

  // ── Backup ────────────────────────────────────────────────────────────────
  const handleBackup = async () => {
    const choice = await showDialog({
      title: 'Backup e Restauração',
      message: 'Você deseja gerar um arquivo de backup com os dados atuais ou importar um arquivo já existente?',
      confirmText: 'Baixar Backup',
      cancelText: 'Importar Arquivo',
      type: 'confirm',
    });
    if (choice === true) {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(employees));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', `rihappy_backup_${Date.now()}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (choice === false) {
      onImportClick();
    }
  };

  const handleAction = async (id: string, label: string) => {
    setMobileMenuOpen(false);
    if (id === 'backup') { await handleBackup(); return; }
    const confirmed = await showDialog({ type: 'confirm', message: `Deseja iniciar a operação: ${label}?` });
    if (!confirmed) return;
    if (id === 'excel') handleExportExcel();
    if (id === 'pdf')   handleExportPDF();
  };

  const actions = [
    { label: 'Excel', id: 'excel', icon: 'table_view',     color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200' },
    { label: 'PDF',   id: 'pdf',   icon: 'picture_as_pdf', color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200'   },
    { label: 'Backup',id: 'backup',icon: 'cloud_upload',   color: 'text-sky-600',   bg: 'bg-sky-50',    border: 'border-sky-200'   },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      {/* Main header row */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14 gap-3">

        {/* Left: Logo + nav */}
        <div className="flex items-center gap-6 sm:gap-8 min-w-0">
          {/* Logo */}
          <button
            onClick={() => onViewChange('dashboard')}
            className="flex items-center gap-2.5 flex-shrink-0 group"
          >
            <div className="w-8 h-8 text-orange-500 transition-transform group-hover:scale-110">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z" fill="currentColor" fillRule="evenodd" />
                <path clipRule="evenodd" d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z" fill="currentColor" fillRule="evenodd" />
              </svg>
            </div>
            <span className="text-slate-900 text-base font-extrabold leading-tight tracking-tighter hidden sm:block">RI HAPPY</span>
          </button>

          {/* Desktop nav tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => onViewChange('dashboard')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-wide transition-all ${currentView === 'dashboard' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Escalas
            </button>
            <button
              onClick={() => onViewChange('team')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-wide transition-all ${currentView === 'team' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Equipe
            </button>
          </nav>
        </div>

        {/* Center: Month badge (desktop) */}
        <div className="hidden sm:flex items-center bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200 gap-2 flex-shrink-0">
          <Icon name="calendar_today" className="text-orange-500 text-sm" />
          <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">
            {months[currentMY.month]} {currentMY.year}
          </span>
        </div>

        {/* Right: Desktop action buttons */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id, action.label)}
              title={action.label}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${action.border} ${action.bg} ${action.color} text-[11px] font-extrabold transition-all hover:opacity-80 active:scale-95`}
            >
              <Icon name={action.icon} className="text-base" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Right: Mobile hamburger + compact actions */}
        <div className="flex items-center gap-2 lg:hidden">
          {/* Compact action icons on tablet/small screens */}
          <div className="hidden sm:flex items-center gap-1.5">
            {actions.map(action => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id, action.label)}
                title={action.label}
                className={`w-8 h-8 rounded-lg border ${action.border} ${action.bg} ${action.color} flex items-center justify-center transition-all hover:opacity-80 active:scale-95`}
              >
                <Icon name={action.icon} className="text-base" />
              </button>
            ))}
          </div>

          {/* Hamburger for mobile */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Menu"
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 pb-4 pt-3 flex flex-col gap-3 animate-fade-in shadow-md">
          {/* Nav */}
          <div className="flex gap-2">
            <button
              onClick={() => { onViewChange('dashboard'); setMobileMenuOpen(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all ${currentView === 'dashboard' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Escalas
            </button>
            <button
              onClick={() => { onViewChange('team'); setMobileMenuOpen(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all ${currentView === 'team' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Equipe
            </button>
          </div>

          {/* Month badge */}
          <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 gap-2">
            <Icon name="calendar_today" className="text-orange-500 text-sm" />
            <span className="text-xs font-extrabold text-slate-700 uppercase">{months[currentMY.month]} {currentMY.year}</span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest px-1">Ações</p>
            {actions.map(action => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id, action.label)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${action.border} ${action.bg} ${action.color} text-sm font-extrabold transition-all active:scale-95`}
              >
                <Icon name={action.icon} className="text-lg" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
