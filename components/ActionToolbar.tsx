import React from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, MonthYear } from '../types';
import * as XLSX from 'xlsx';
import { Icon } from './Icon';

interface ActionToolbarProps {
  employees: Employee[];
  currentMY: MonthYear;
  onImportClick: () => void;
  onOptimizePeakWeek?: () => void;
}

const WEEKDAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const MONTHS_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const ActionToolbar: React.FC<ActionToolbarProps> = ({ employees, currentMY, onImportClick, onOptimizePeakWeek }) => {
  const { showDialog } = useDialog();

  const monthKey = `${currentMY.year}-${currentMY.month.toString().padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();

  // Build day labels: "01\nSEG", "02\nTER", etc.
  const dayLabels = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(currentMY.year, currentMY.month, i + 1);
    const dayNum = String(i + 1).padStart(2, '0');
    const wd = WEEKDAY_ABBR[date.getDay()];
    return `${dayNum}\n${wd}`;
  });

  // ── Excel export ────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    // Row 1: header  (Nome | Horário | 01\nSEG | 02\nTER | ...)
    const header = ['Nome', 'Horário', ...dayLabels];

    const sortedEmployeesForExcel = [...employees].sort((a, b) => {
      const getStartHour = (wp: string) => {
        const match = wp.match(/(\d+)h/);
        return match ? parseInt(match[1]) : 99;
      };
      const hA = getStartHour(a.workPeriod || '');
      const hB = getStartHour(b.workPeriod || '');
      if (hA !== hB) return hA - hB;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    const rows = sortedEmployeesForExcel.map(emp => {
      const row: (string | number)[] = [
        emp.name,
        emp.workPeriod, // horário padrão substituindo "Perfil"
      ];
      for (let i = 0; i < daysInMonth; i++) {
        const shift = (emp.shifts[monthKey] || [])[i] || 'F';
        if (['F', 'FF', 'FE', 'C'].includes(shift)) {
          row.push(shift);
        } else {
          // Show abbreviated hour if working
          const h = (emp.dailyHours[monthKey] || [])[i] || emp.workPeriod;
          row.push(h.split(' ')[0]); // "10h" instead of full string
        }
      }
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    // Column widths
    ws['!cols'] = [
      { wch: 22 }, // Nome
      { wch: 14 }, // Horário
      ...Array(daysInMonth).fill({ wch: 6 }),
    ];

    // Style header row (bold) via cell metadata — xlsx/js doesn't support rich styles
    // without xlsx-style, so we just ensure row heights
    ws['!rows'] = [{ hpt: 28 }]; // taller header row for the two-line day labels

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Escala');
    XLSX.writeFile(wb, `Escala_${monthKey}.xlsx`);
  };

  // ── PDF export ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      // Dynamic import avoids Vite/ESM build issues with jsPDF + autoTable
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const monthName = MONTHS_NAMES[currentMY.month];

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`Escala Operacional – ${monthName} ${currentMY.year}`, 40, 35);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 40, 48);
      doc.setTextColor(0, 0, 0);

      // Header: Name | Horário | 01 SEG | 02 TER | ...
      const head = [[
        'Colaborador',
        'Horário',
        ...Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(currentMY.year, currentMY.month, i + 1);
          return `${i + 1}\n${WEEKDAY_ABBR[date.getDay()]}`;
        }),
      ]];

      const sortedEmployees = [...employees].sort((a, b) => {
        const getStartHour = (wp: string) => {
          const match = wp.match(/(\d+)h/);
          return match ? parseInt(match[1]) : 99;
        };
        const hA = getStartHour(a.workPeriod || '');
        const hB = getStartHour(b.workPeriod || '');
        if (hA !== hB) return hA - hB;
        return a.name.localeCompare(b.name, 'pt-BR');
      });

      const body = sortedEmployees.map(emp => {
        const shiftCells = Array.from({ length: daysInMonth }, (_, i) => {
          const s = (emp.shifts[monthKey] || [])[i] || 'F';
          
          const dDateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const isBday = emp.birthday && (emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday) === dDateStr.substring(5);

          if (isBday) return 'DO';
          if (['F', 'FF', 'FE', 'C'].includes(s)) return s;
          return ''; // Deixa em branco para dias trabalhados
        });
        return [emp.name, emp.workPeriod.split(' ')[0], ...shiftCells];
      });

      (doc as any).autoTable({
        head,
        body,
        startY: 58,
        styles: { fontSize: 6, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: {
          fillColor: [249, 115, 22],  // orange-500
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 6.5,
          minCellHeight: 28,
        },
        bodyStyles: { textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 80, halign: 'left' },
          1: { cellWidth: 38, halign: 'left' },
        },
        // Color cells by shift type
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index >= 2) {
            const val = data.cell.raw as string;
            if (val === 'F' || val === 'DO')  { data.cell.styles.fillColor = [253, 186, 116]; data.cell.styles.textColor = [154, 52, 18]; } // orange
            if (val === 'FF') { data.cell.styles.fillColor = [254, 202, 202]; data.cell.styles.textColor = [153, 27, 27]; } // red
            if (val === 'FE') { data.cell.styles.fillColor = [221, 214, 254]; data.cell.styles.textColor = [76, 29, 149]; } // purple
            if (val === 'C')  { data.cell.styles.fillColor = [204, 251, 241]; data.cell.styles.textColor = [15, 118, 110]; } // teal
          }
        },
      });

      doc.save(`Escala_${monthKey}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      await showDialog({ type: 'alert', message: 'Erro ao gerar PDF. Verifique o console.' });
    }
  };

  // ── Backup ──────────────────────────────────────────────────────────────────
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

  const actions = [
    { label: 'Exportar Excel', id: 'excel', icon: 'table_view',      color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Gerar PDF',      id: 'pdf',   icon: 'picture_as_pdf',  color: 'text-red-600',   bg: 'bg-red-50'   },
    { label: 'Backup Nuvem',   id: 'backup', icon: 'cloud_upload',   color: 'text-sky-600',   bg: 'bg-sky-50'   },
    ...(onOptimizePeakWeek ? [{ 
      label: currentMY.month === 9 ? 'Otimizar Crianças (8-12)' : currentMY.month === 11 ? 'Otimizar Natal (18-24)' : 'Otimizar Pico', 
      id: 'peak', 
      icon: currentMY.month === 9 ? 'celebration' : 'auto_awesome', 
      color: 'text-amber-600', 
      bg: 'bg-amber-50' 
    }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 mb-8 animate-fade-in">
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-md">
        <Icon name="offline_bolt" fill className="text-orange-400" />
        <span className="text-[11px] font-extrabold uppercase tracking-widest">Painel de Ações</span>
      </div>

      {actions.map((action, idx) => (
        <button
          key={idx}
          onClick={async () => {
            if (action.id === 'backup') { await handleBackup(); return; }
            if (action.id === 'peak' || action.id === 'natal') { onOptimizePeakWeek?.(); return; }
            const confirmed = await showDialog({
              type: 'confirm',
              message: `Deseja iniciar a operação: ${action.label}?`,
            });
            if (confirmed) {
              if (action.id === 'excel') handleExportExcel();
              if (action.id === 'pdf')   handleExportPDF();
            }
          }}
          className="flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-200 transition-all bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm group"
        >
          <div className={`w-8 h-8 ${action.bg} ${action.color} rounded-lg flex items-center justify-center`}>
            <Icon name={action.icon} className="text-lg" />
          </div>
          <span className="text-sm font-bold text-slate-700">{action.label}</span>
        </button>
      ))}

      <div className="hidden xl:flex items-center gap-3 ml-auto px-6 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
        <Icon name="info" className="text-orange-500 text-sm" />
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
          Escalas de domingos são rotativas automaticamente.
        </p>
      </div>
    </div>
  );
};
