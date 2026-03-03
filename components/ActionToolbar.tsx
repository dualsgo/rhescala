import React from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, MonthYear } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Icon } from './Icon';

interface ActionToolbarProps {
  employees: Employee[];
  currentMY: MonthYear;
  onImportClick: () => void;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({ employees, currentMY, onImportClick }) => {
  const actions = [
    { label: 'Exportar Excel', id: 'excel', icon: 'table_view', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Gerar PDF', id: 'pdf', icon: 'picture_as_pdf', color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Backup Nuvem', id: 'backup', icon: 'cloud_upload', color: 'text-sky-600', bg: 'bg-sky-50' }
  ];

  const { showDialog } = useDialog();

  const handleExportExcel = () => {
    const monthKey = `${currentMY.year}-${currentMY.month.toString().padStart(2, '0')}`;
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    
    const data = employees.map(emp => {
      const row: any = { Nome: emp.name, Perfil: emp.isYoungApprentice ? 'Jovem Aprendiz' : 'CLT' };
      for (let i = 0; i < daysInMonth; i++) {
        const shift = (emp.shifts[monthKey] || [])[i] || 'F';
        const hour = (emp.dailyHours[monthKey] || [])[i] || emp.workPeriod;
        row[`Dia ${i + 1}`] = shift === 'F' || shift === 'FF' || shift === 'FE' || shift === 'C' ? shift : hour;
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Escala");
    XLSX.writeFile(wb, `Escala_${monthKey}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const monthKey = `${currentMY.year}-${currentMY.month.toString().padStart(2, '0')}`;
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    
    doc.setFontSize(14);
    doc.text(`Escala Operacional - Mês ${currentMY.month + 1}/${currentMY.year}`, 14, 15);
    
    const head = [['Colaborador', ...Array.from({length: daysInMonth}, (_, i) => `${i+1}`)]];
    const body = employees.map(emp => {
      const shifts = Array.from({length: daysInMonth}, (_, i) => {
        const s = (emp.shifts[monthKey] || [])[i] || 'F';
        if (['F','FF','FE','C'].includes(s)) return s;
        // Simplified hour for PDF fit
        const h = ((emp.dailyHours[monthKey] || [])[i] || emp.workPeriod).substring(0, 5); 
        return h;
      });
      return [emp.name, ...shifts];
    });

    (doc as any).autoTable({
      head,
      body,
      startY: 20,
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [249, 115, 22] }, // orange-500
      columnStyles: { 0: { cellWidth: 35 } }
    });

    doc.save(`Escala_${monthKey}.pdf`);
  };

  const handleBackup = async () => {
    const choice = await showDialog({
      title: 'Backup e Restauração',
      message: 'Você deseja gerar um arquivo de backup com os dados atuais ou importar um arquivo já existente? O arquivo gerado pode ser salvo no seu Google Drive ou outro serviço de nuvem para segurança.',
      confirmText: 'Baixar Backup',
      cancelText: 'Importar Arquivo',
      type: 'confirm'
    });

    if (choice === true) {
      // Export JSON
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(employees));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", `rihappy_backup_${new Date().getTime()}.json`);
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } else if (choice === false) {
      // Import JSON
      onImportClick();
    }
  };

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
               if (action.id === 'backup') {
                 await handleBackup();
                 return;
               }

               const confirmed = await showDialog({
                 type: 'confirm',
                 message: `Deseja iniciar a operação: ${action.label}?`
               });
               
               if (confirmed) {
                 if (action.id === 'excel') handleExportExcel();
                 if (action.id === 'pdf') handleExportPDF();
               }
            }}
          className={`flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-200 transition-all bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm group`}
        >
          <div className={`w-8 h-8 ${action.bg} ${action.color} rounded-lg flex items-center justify-center border border-transparent group-hover:border-current/10`}>
            <Icon name={action.icon} className="text-lg" />
          </div>
          <span className="text-sm font-bold text-slate-700">{action.label}</span>
        </button>
      ))}

      <div className="hidden xl:flex items-center gap-3 ml-auto px-6 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
        <Icon name="info" className="text-orange-500 text-sm" />
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">Escalas de domingos são rotativas automaticamente.</p>
      </div>
    </div>
  );
};
