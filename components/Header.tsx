
import React, { useState } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Icon } from './Icon';
import { Employee, MonthYear, Holiday, SyncState } from '../types';
import * as XLSX from 'xlsx';
import { buildHolidaySet } from '../constants';
import { useSyncStatus } from '../hooks/useLocalStorage';

const WEEKDAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const actions = [
    { label: 'Excel', id: 'excel', icon: 'table_view',     color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200' },
    { label: 'PDF',   id: 'pdf',   icon: 'picture_as_pdf', color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200'   },
    { label: 'Backup',id: 'backup',icon: 'cloud_upload',   color: 'text-sky-600',   bg: 'bg-sky-50',    border: 'border-sky-200'   },
];

interface HeaderProps {
  currentView: 'dashboard' | 'team';
  onViewChange: (view: 'dashboard' | 'team') => void;
  currentMY: MonthYear;
  employees: Employee[];
  customHolidays: Holiday[];
  onImportClick: () => void;
  onForceSync: () => Promise<void>;
  isDarkMode: boolean;
  onDarkModeToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  currentMY,
  employees,
  customHolidays,
  onImportClick,
  onForceSync,
  isDarkMode,
  onDarkModeToggle,
}) => {
  const { showDialog } = useDialog();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const syncStatus = useSyncStatus();

  const monthName = months[currentMY.month];
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
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
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
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

      const body = employees.filter(e => !e.isHidden).map(emp => {
        const shiftCells = Array.from({ length: daysInMonth }, (_, i) => {
          const s = (emp.shifts[monthKey] || [])[i] || 'F';
          if (['F', 'FF', 'FE', 'C'].includes(s)) return s;
          return 'T'; // Use 'T' for working days in the cells
        });
        const mainPeriod = emp.workPeriod.includes(' às ') ? emp.workPeriod.replace(' às ', '-') : emp.workPeriod;
        return [emp.name, mainPeriod, ...shiftCells];
      });

      const hSet = buildHolidaySet(currentMY.year, customHolidays);

      autoTable(doc, {
        head,
        body,
        startY: 55,
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        styles: { 
          fontSize: 6, // Increased back slightly as 'T' is small
          cellPadding: 1.5, 
          halign: 'center', 
          valign: 'middle', 
          lineWidth: 0.5, 
          lineColor: [0, 0, 0],
          overflow: 'linebreak'
        },
        headStyles: { 
          fillColor: [255, 255, 255], 
          textColor: [0, 0, 0], 
          fontStyle: 'bold', 
          fontSize: 6, 
          minCellHeight: 25 
        },
        bodyStyles: { textColor: [0, 0, 0], minCellHeight: 15 },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles: { 
          0: { cellWidth: 70, halign: 'center' }, 
          1: { cellWidth: 45, halign: 'center' } 
        },
        didParseCell: (data: any) => {
          if (data.column.index >= 2) {
             const dayNum = data.column.index - 1; 
             const date = new Date(currentMY.year, currentMY.month, dayNum);
             const isSun = date.getDay() === 0;
             const hKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
             const isHol = hSet.has(hKey);

             if (data.section === 'head') {
                if (isSun || isHol) data.cell.styles.fillColor = [240, 240, 240]; 
             }
             
             if (data.section === 'body') {
               const val = data.cell.raw as string;
               if (['F', 'FF', 'FE', 'C'].includes(val)) {
                 data.cell.styles.fontStyle = 'bold';
               }
               
               if ((isSun || isHol)) {
                 data.cell.styles.fillColor = [245, 245, 245];
               }
             }
          }
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 30;
      
      // ── Legenda ───────────────────────────────────────────────────────────
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('LEGENDA:', 40, finalY);
      
      const legend = [
        'T: Trabalha',
        'F: Folga Normal',
        'FF: Folga Feriado',
        'FE: Férias',
        'C: Dia de Curso (Aprendiz)'
      ];
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      legend.forEach((text, i) => {
        doc.text(text, 40 + (i * 105), finalY + 15);
      });

      // ── Informações do Mês ────────────────────────────────────────────────
      let infoY = finalY + 45;
      const colWidth = 250;
      
      // Feriados do Mês
      const monthHolidays = customHolidays.filter(h => {
        if (!h.date) return false;
        const hDate = new Date(h.date + 'T00:00:00');
        return hDate.getMonth() === currentMY.month && hDate.getFullYear() === currentMY.year;
      });

      if (monthHolidays.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('FERIADOS DO MÊS:', 40, infoY);
        doc.setFont('helvetica', 'normal');
        monthHolidays.forEach((h, i) => {
          if (!h.date) return;
          const d = h.date.split('-')[2];
          doc.text(`• ${d}/${currentMY.month + 1}: ${h.name}`, 40, infoY + 12 + (i * 10));
        });
      }

      // Aniversariantes do Mês
      const birthdays = employees.filter(e => {
        if (!e.birthday || e.id === 'placeholder-em-id') return false;
        const bDate = new Date(e.birthday + 'T00:00:00');
        return bDate.getMonth() === currentMY.month;
      });

      const birthdayX = 40 + colWidth;
      if (birthdays.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('ANIVERSARIANTES DO MÊS:', birthdayX, infoY);
        doc.setFont('helvetica', 'normal');
        birthdays.forEach((e, i) => {
          const d = e.birthday?.split('-')[2];
          doc.text(`🎂 ${d}/${currentMY.month + 1}: ${e.name.toUpperCase()}`, birthdayX, infoY + 12 + (i * 10));
        });
      }

      // Colaboradores em Férias
      const onVacation = employees.filter(e => {
        if (!e.vacationStart || !e.vacationEnd || e.id === 'placeholder-em-id') return false;
        const start = new Date(e.vacationStart + 'T00:00:00');
        const end = new Date(e.vacationEnd + 'T00:00:00');
        const monthStart = new Date(currentMY.year, currentMY.month, 1);
        const monthEnd = new Date(currentMY.year, currentMY.month + 1, 0);
        return (start <= monthEnd && end >= monthStart);
      });

      const vacationX = 40 + (colWidth * 2);
      if (onVacation.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('COLABORADORES EM FÉRIAS:', vacationX, infoY);
        doc.setFont('helvetica', 'normal');
        onVacation.forEach((e, i) => {
          const s = e.vacationStart?.split('-').reverse().join('/');
          const f = e.vacationEnd?.split('-').reverse().join('/');
          doc.text(`🌴 ${e.name.toUpperCase()}: ${s} até ${f}`, vacationX, infoY + 12 + (i * 10));
        });
      }

      // ── Assinatura ─────────────────────────────────────────────────────────
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setDrawColor(0);
      doc.line(pageWidth - 240, pageHeight - 50, pageWidth - 40, pageHeight - 50);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('ASSINATURA DO GERENTE / RESPONSÁVEL', pageWidth - 140, pageHeight - 38, { align: 'center' });

      doc.save(`Escala_${monthKey}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      await showDialog({ type: 'alert', message: 'Erro ao gerar PDF. Verifique se as dependências estão instaladas corretamente.' });
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

  const navItems = [
    { id: 'dashboard', label: 'Escalas', icon: 'dashboard' },
    { id: 'team', label: 'Equipe', icon: 'groups' },
    { id: 'analysis', label: 'Análise', icon: 'insights' },
  ];

  const handleNavClick = (view: 'dashboard' | 'team' | 'analysis') => {
    onViewChange(view);
    setMobileMenuOpen(false);
  };

  return (
    <>
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm transition-colors">
      {/* Main header row */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14 gap-3">

        {/* Left: Hamburger (mobile) + Logo */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} />
          </button>

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
            <span className="text-slate-900 dark:text-slate-100 text-base font-extrabold leading-tight tracking-tighter hidden sm:block">RI HAPPY</span>
          </button>

          {/* Desktop nav tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as any)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-wide transition-all ${currentView === item.id ? 'bg-white dark:bg-slate-800 shadow-sm text-orange-600 dark:text-orange-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Theme Toggle */}
          <button
            onClick={onDarkModeToggle}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
          >
            <Icon name={isDarkMode ? 'light_mode' : 'dark_mode'} fill={isDarkMode} />
          </button>
        </div>

        {/* Center: Month badge (desktop) */}
        <div className="hidden sm:flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-1.5 border border-slate-200 dark:border-slate-700 gap-2 flex-shrink-0">
          <Icon name="calendar_today" className="text-orange-500 text-sm" />
          <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            {months[currentMY.month]} {currentMY.year}
          </span>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowSyncHistory(!showSyncHistory)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all hover:bg-slate-50 active:scale-95 ${
              syncStatus.state === 'syncing' ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse' :
              syncStatus.state === 'synced' ? 'bg-green-50 border-green-200 text-green-600' :
              syncStatus.state === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
              'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <Icon 
              name={
                syncStatus.state === 'syncing' ? 'sync' :
                syncStatus.state === 'synced' ? 'cloud_done' :
                syncStatus.state === 'error' ? 'cloud_off' :
                'cloud'
              } 
              className={`text-sm ${syncStatus.state === 'syncing' ? 'animate-spin' : ''}`} 
            />
            <div className="flex flex-col items-start leading-none">
              <span className="text-[9px] font-extrabold uppercase tracking-tight">
                {syncStatus.state === 'syncing' ? 'Sincronizando...' :
                 syncStatus.state === 'synced' ? 'Sincronizado' :
                 syncStatus.state === 'error' ? 'Atenção: Offline' :
                 'Nuvem Pronta'}
              </span>
              {syncStatus.lastSync && (
                <span className="text-[8px] font-medium opacity-80">{syncStatus.lastSync}</span>
              )}
            </div>
          </button>

          {/* Sync History Dropdown */}
          {showSyncHistory && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] p-3 animate-fade-in">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Histórico de Sinc.</h4>
                <button onClick={() => setShowSyncHistory(false)} className="text-slate-400 hover:text-slate-600">
                  <Icon name="close" className="text-sm" />
                </button>
              </div>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                <button
                  onClick={async () => {
                    await onForceSync();
                    setShowSyncHistory(false);
                  }}
                  className="w-full py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-extrabold uppercase rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 mb-2"
                >
                  <Icon name="sync" className="text-xs" /> Sincronizar Agora (Baixar Nuvem)
                </button>
                {syncStatus.history.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-4">Nenhuma atividade registrada.</p>
                ) : (
                  syncStatus.history.map((item, idx) => (
                    <div key={idx} className="flex gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        item.state === 'syncing' ? 'bg-blue-500' :
                        item.state === 'synced' ? 'bg-green-500' :
                        item.state === 'error' ? 'bg-red-500' :
                        'bg-slate-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-bold text-slate-700 truncate">{item.message || item.state}</span>
                          <span className="text-[8px] text-slate-400 whitespace-nowrap">{item.timestamp}</span>
                        </div>
                        <p className="text-[8px] text-slate-500 truncate mt-0.5">Chave: {item.key}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
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

        {/* Right: Mobile hamburger actions (hidden on desktop) */}
        <div className="flex items-center gap-2 lg:hidden">
            {/* Compact action icons on small screens */}
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
        </div>
      </div>

      {/* Mobile nav menu overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] animate-fade-in shadow-2xl">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-[3.5rem] inset-x-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-2 flex flex-col gap-1 transition-colors">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as any)}
                className={`flex items-center gap-4 p-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  currentView === item.id 
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon name={item.icon} className="text-lg" />
                {item.label}
              </button>
            ))}
            
            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
            
            {actions.map(action => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id, action.label)}
                className={`flex items-center gap-4 p-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${action.color} hover:bg-slate-50 dark:hover:bg-slate-800`}
              >
                <Icon name={action.icon} className="text-lg" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
    </>
  );
};

