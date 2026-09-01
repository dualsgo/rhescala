import React, { useRef, useState } from 'react';
import { SyncStatus, Employee, Holiday, JornadaSettings, OfficialScheduleSnapshot, ProtectedDaysMap } from '../types';
import { Icon } from './Icon';
import { useDialog } from '../contexts/DialogContext';
import { apiStore } from '../src/gas-api';

interface DataManagerProps {
  syncStatus: SyncStatus;
  employees: Employee[];
  setEmployees: (val: Employee[] | ((prev: Employee[]) => Employee[])) => void;
  validatedMonths: Record<string, boolean>;
  setValidatedMonths: (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  officialSnapshots?: Record<string, OfficialScheduleSnapshot>;
  setOfficialSnapshots?: (val: Record<string, OfficialScheduleSnapshot> | ((prev: Record<string, OfficialScheduleSnapshot>) => Record<string, OfficialScheduleSnapshot>)) => void;
  jornadaSettings?: JornadaSettings;
  setJornadaSettings?: (val: JornadaSettings | ((prev: JornadaSettings) => JornadaSettings)) => void;
  customHolidays?: Holiday[];
  setCustomHolidays?: (val: Holiday[] | ((prev: Holiday[]) => Holiday[])) => void;
  deletedNationalHolidays?: string[];
  setDeletedNationalHolidays?: (val: string[] | ((prev: string[]) => string[])) => void;
  monthNotes?: Record<string, string>;
  setMonthNotes?: (val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  trackingStartDate?: string;
  setTrackingStartDate?: (val: string | ((prev: string) => string)) => void;
  sectionAssignments?: Record<string, any>;
  setSectionAssignments?: (val: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  protectedDaysMap?: ProtectedDaysMap;
  setProtectedDaysMap?: (val: any) => void;
  onClose: () => void;
  role: 'admin' | 'viewer';
}

export const DataManager: React.FC<DataManagerProps> = ({ 
  syncStatus, 
  employees, 
  setEmployees, 
  validatedMonths, 
  setValidatedMonths, 
  officialSnapshots,
  setOfficialSnapshots,
  jornadaSettings,
  setJornadaSettings,
  customHolidays,
  setCustomHolidays,
  deletedNationalHolidays,
  setDeletedNationalHolidays,
  monthNotes,
  setMonthNotes,
  trackingStartDate,
  setTrackingStartDate,
  sectionAssignments,
  setSectionAssignments,
  protectedDaysMap,
  setProtectedDaysMap,
  onClose, 
  role 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showDialog } = useDialog();
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);
  const [passForm, setPassForm] = useState({ role: 'admin' as 'admin' | 'viewer', password: '' });

  const handleExportBackup = () => {
    const backupData = {
      system: "rhescala",
      version: "2.1",
      exportedAt: new Date().toISOString(),
      employees,
      validatedMonths,
      officialSnapshots,
      jornadaSettings,
      customHolidays,
      deletedNationalHolidays,
      monthNotes,
      trackingStartDate,
      sectionAssignments,
      protectedDaysMap
    };
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rhescala_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSalesSchedule = () => {
    const escalas: Array<{ colaborador: string; data: string; posicao: string }> = [];

    employees.forEach(emp => {
      if (emp.status === 'inactive' || emp.isHidden) return;

      const keysSet = new Set<string>();
      if (emp.shifts) Object.keys(emp.shifts).forEach(k => keysSet.add(k));
      if (emp.tacticalPositions) Object.keys(emp.tacticalPositions).forEach(k => keysSet.add(k));

      keysSet.forEach(mKey => {
        const parts = mKey.split('-');
        if (parts.length !== 2) return;

        const shiftsArr = emp.shifts?.[mKey] || [];
        const tactArr = emp.tacticalPositions?.[mKey] || [];
        const maxDays = Math.max(shiftsArr.length, tactArr.length);

        for (let d = 1; d <= maxDays; d++) {
          const idx = d - 1;
          const dayStr = String(d).padStart(2, '0');
          const fullDate = `${mKey}-${dayStr}`;

          const tactPos = tactArr[idx];
          const shiftVal = shiftsArr[idx];

          let pos = (tactPos && typeof tactPos === 'string' && tactPos.trim()) 
            ? tactPos.trim() 
            : (shiftVal && typeof shiftVal === 'string' && shiftVal.trim() ? shiftVal.trim() : 'NONE');

          escalas.push({
            colaborador: emp.name,
            data: fullDate,
            posicao: pos
          });
        }
      });
    });

    const exportData = {
      system: "rhescala",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      escalas
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `escala_vendas_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        const hasValidEmployees = Array.isArray(importedData) || (importedData.employees && Array.isArray(importedData.employees));

        if (hasValidEmployees) {
          const confirm = await showDialog({
            title: 'Importar Backup',
            message: 'Atenção: Isso irá substituir a escala e configurações pelos dados do arquivo. Deseja continuar?',
            type: 'confirm'
          });

          if (confirm) {
            if (importedData.employees && Array.isArray(importedData.employees)) {
              setEmployees(importedData.employees);
              if (importedData.validatedMonths && setValidatedMonths) {
                setValidatedMonths(importedData.validatedMonths);
              }
              if (importedData.officialSnapshots && setOfficialSnapshots) {
                setOfficialSnapshots(importedData.officialSnapshots);
              }
              if (importedData.jornadaSettings && setJornadaSettings) {
                setJornadaSettings(importedData.jornadaSettings);
              }
              if (importedData.customHolidays && setCustomHolidays) {
                setCustomHolidays(importedData.customHolidays);
              }
              if (importedData.deletedNationalHolidays && setDeletedNationalHolidays) {
                setDeletedNationalHolidays(importedData.deletedNationalHolidays);
              }
              if (importedData.monthNotes && setMonthNotes) {
                setMonthNotes(importedData.monthNotes);
              }
              if (importedData.trackingStartDate && setTrackingStartDate) {
                setTrackingStartDate(importedData.trackingStartDate);
              }
              if (importedData.sectionAssignments && setSectionAssignments) {
                setSectionAssignments(importedData.sectionAssignments);
              }
              if (importedData.protectedDaysMap && setProtectedDaysMap) {
                setProtectedDaysMap(importedData.protectedDaysMap);
              }
            } else if (Array.isArray(importedData)) {
              // Legacy support for older backups that only had the employees array
              setEmployees(importedData);
            }
            await showDialog({ title: 'Sucesso', message: 'Backup restaurado com sucesso!' });
          }
        } else {
          throw new Error('Formato inválido');
        }
      } catch (err) {
        await showDialog({ title: 'Erro', message: 'Falha ao ler o arquivo de backup. Verifique se o arquivo é válido.' });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleUpdatePassword = async () => {
    if (!passForm.password) return;
    
    const confirm = await showDialog({
      title: 'Alterar Senha',
      message: `Deseja realmente alterar a senha de ${passForm.role === 'admin' ? 'Administrador' : 'Visualizador'}?`,
      type: 'confirm'
    });

    if (!confirm) return;

    setIsUpdatingPass(true);
    try {
      const result = await apiStore.updatePassword(passForm.role, passForm.password);
      if (result.success) {
        await showDialog({ title: 'Sucesso', message: 'Senha atualizada na planilha com sucesso!' });
        setPassForm({ ...passForm, password: '' });
      } else {
        await showDialog({ title: 'Erro', message: result.error || 'Falha ao atualizar senha.' });
      }
    } catch (err) {
      await showDialog({ title: 'Erro', message: 'Erro de conexão.' });
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const getStatusColor = (state: string) => {
    if (state === 'synced') return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30';
    if (state === 'syncing') return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
    if (state === 'error') return 'text-red-500 bg-red-100 dark:bg-red-900/30';
    return 'text-slate-500 bg-slate-100 dark:bg-slate-800';
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-4xl mx-auto mt-6 animate-fade-in overflow-y-auto max-h-[85vh] custom-scrollbar">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-800 dark:text-slate-100">Gerenciamento do Sistema</h2>
          <p className="text-sm font-bold text-slate-400 mt-1">Nuvem, Backups e Segurança</p>
        </div>
        <button onClick={onClose} className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors">
          Voltar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Lado Esquerdo: Status e Segurança */}
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Status do Banco de Dados</h3>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getStatusColor(syncStatus.state)}`}>
                <Icon name={syncStatus.state === 'synced' ? 'cloud_done' : syncStatus.state === 'syncing' ? 'cloud_sync' : syncStatus.state === 'error' ? 'cloud_off' : 'cloud'} className="text-3xl" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-800 dark:text-slate-100 capitalize">
                  {syncStatus.state === 'synced' ? 'Sincronizado' : syncStatus.state === 'syncing' ? 'Sincronizando...' : syncStatus.state === 'error' ? 'Erro de Conexão' : 'Aguardando'}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-1">Última atualização: {syncStatus.lastSync || 'Desconhecida'}</p>
              </div>
            </div>
          </div>

          {/* Gerenciamento de Senhas - Apenas Admin */}
          {role === 'admin' && (
            <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-inner">
              <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4">Configurações de Acesso</h3>
              <p className="text-[11px] text-slate-400 mb-4 font-medium">Altere as senhas armazenadas na sua planilha Google.</p>
              
              <div className="space-y-4">
                <div className="flex bg-slate-800 rounded-xl p-1">
                  <button 
                    onClick={() => setPassForm({...passForm, role: 'admin'})}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${passForm.role === 'admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Admin
                  </button>
                  <button 
                    onClick={() => setPassForm({...passForm, role: 'viewer'})}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${passForm.role === 'viewer' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Viewer
                  </button>
                </div>
                
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Nova Senha"
                    value={passForm.password}
                    onChange={(e) => setPassForm({...passForm, password: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <button 
                  onClick={handleUpdatePassword}
                  disabled={isUpdatingPass || !passForm.password}
                  className="w-full py-3 bg-white text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdatingPass ? (
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                  ) : 'Atualizar na Planilha'}
                </button>
                
                <p className="text-[9px] text-slate-500 text-center italic mt-2">Dica: As senhas são salvas na aba "Config" da sua planilha.</p>
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Histórico e Backup */}
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Arquivos e Backups</h3>
            <div className="flex flex-col gap-3">
              <button onClick={handleExportBackup} className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest transition-colors shadow-sm">
                <Icon name="download" className="text-base" />
                Backup Local (.json)
              </button>
              <button onClick={handleExportSalesSchedule} className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest transition-colors shadow-sm">
                <Icon name="analytics" className="text-base" />
                Exportar Escala para Vendas (.json)
              </button>
              
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-orange-500 text-slate-700 dark:text-slate-300 rounded-xl font-bold uppercase text-[11px] tracking-widest transition-all shadow-sm">
                <Icon name="upload" className="text-base" />
                Restaurar Backup
              </button>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportBackup} className="hidden" />

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
              
              <button 
                onClick={async () => {
                  const confirm = await showDialog({
                    title: 'Limpar Mural',
                    message: 'Isso irá apagar TODOS os pedidos/recados de todos os colaboradores. Deseja continuar?',
                    type: 'confirm'
                  });
                  if (confirm) {
                    setEmployees(prev => prev.map(emp => ({ ...emp, requests: [] })));
                    await showDialog({ title: 'Sucesso', message: 'Mural de pedidos limpo!' });
                  }
                }}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all"
              >
                <Icon name="delete_sweep" className="text-base" />
                Limpar Todos os Pedidos
              </button>

              <button 
                onClick={async () => {
                  const confirm = await showDialog({
                    title: 'Otimizar Nuvem',
                    message: 'Isso irá apagar o histórico de versões antigas na sua planilha para deixá-la mais leve. Seus dados atuais não serão afetados. Deseja continuar?',
                    type: 'confirm'
                  });
                  if (confirm) {
                    try {
                      const res = await apiStore.vacuum();
                      if (res.success) {
                        await showDialog({ title: 'Sucesso', message: `Otimização concluída! Foram removidas ${res.removedRows} versões antigas.` });
                      } else {
                        throw new Error(res.error);
                      }
                    } catch (e) {
                      await showDialog({ title: 'Erro', message: 'Falha na otimização da nuvem.' });
                    }
                  }
                }}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all"
              >
                <Icon name="auto_fix_high" className="text-base" />
                Otimizar Planilha (Nuvem)
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[300px]">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Histórico de Sincronização</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {syncStatus.history && syncStatus.history.length > 0 ? (
                syncStatus.history.map((log, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-3 shadow-sm">
                    <div className={`mt-0.5 p-1 rounded-lg ${getStatusColor(log.state)}`}>
                      <Icon name={log.state === 'synced' ? 'check_circle' : log.state === 'error' ? 'error' : 'sync'} className="text-sm" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{log.message || 'Sincronização'}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{log.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <Icon name="history" className="text-4xl text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vazio</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

