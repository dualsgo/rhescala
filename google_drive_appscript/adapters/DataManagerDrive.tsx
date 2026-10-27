import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useDialog } from '../../contexts/DialogContext';
import { apiStore, isGasEnvironment } from './gas-api';
import { toLocalISODate } from '../../src/utils/date';
import {
  SyncStatus,
  Employee,
  Holiday,
  JornadaSettings,
  OfficialScheduleSnapshot,
  ProtectedDaysMap,
  AuditLogEntry,
} from '../../types';

interface DataManagerDriveProps {
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
  auditLogs?: AuditLogEntry[];
  setAuditLogs?: (val: AuditLogEntry[] | ((prev: AuditLogEntry[]) => AuditLogEntry[])) => void;
  onExportScheduleCsv?: () => void;
  onClose: () => void;
  role: 'admin' | 'viewer';
}

export const DataManager: React.FC<DataManagerDriveProps> = (props) => {
  const { showDialog } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [driveInfo, setDriveInfo] = useState<{ spreadsheetUrl?: string; spreadsheetName?: string; folderUrl?: string } | null>(null);
  const [savingDrive, setSavingDrive] = useState(false);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);
  const [passForm, setPassForm] = useState({ role: 'admin' as 'admin' | 'viewer', password: '' });

  useEffect(() => {
    if (!isGasEnvironment()) return;
    apiStore.getDriveInfo().then((info) => {
      if (info) setDriveInfo(info);
    });
  }, []);

  const buildBackupObject = () => ({
    system: 'rhescala',
    version: '2.1',
    exportedAt: new Date().toISOString(),
    employees: props.employees,
    validatedMonths: props.validatedMonths,
    officialSnapshots: props.officialSnapshots,
    jornadaSettings: props.jornadaSettings,
    customHolidays: props.customHolidays,
    deletedNationalHolidays: props.deletedNationalHolidays,
    monthNotes: props.monthNotes,
    trackingStartDate: props.trackingStartDate,
    protectedDaysMap: props.protectedDaysMap,
    auditLogs: props.auditLogs,
  });

  const handleSaveBackupToDrive = async () => {
    setSavingDrive(true);
    try {
      const fileName = `rhescala_backup_${toLocalISODate()}.json`;
      const res = await apiStore.saveBackupToDrive(fileName, JSON.stringify(buildBackupObject(), null, 2));
      await showDialog({
        title: res.success ? 'Salvo no Google Drive' : 'Aviso',
        message: res.success
          ? `Arquivo "${res.fileName}" salvo na pasta "Rhescala - Sistema de Escalas" do Google Drive!`
          : res.error || 'Não foi possível salvar no Google Drive.',
      });
    } finally {
      setSavingDrive(false);
    }
  };

  const handleExportLocalJson = () => {
    const blob = new Blob([JSON.stringify(buildBackupObject(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rhescala_backup_${toLocalISODate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result || '{}'));
        const emps = Array.isArray(parsed) ? parsed : parsed?.employees;
        if (!Array.isArray(emps)) throw new Error('Formato inválido');

        const ok = await showDialog({
          title: 'Restaurar Backup',
          message: 'Substituir a escala e as configurações atuais pelos dados deste arquivo?',
          type: 'confirm',
        });
        if (ok) {
          props.setEmployees(emps);
          if (parsed.validatedMonths) props.setValidatedMonths(parsed.validatedMonths);
          if (parsed.officialSnapshots && props.setOfficialSnapshots) props.setOfficialSnapshots(parsed.officialSnapshots);
          if (parsed.jornadaSettings && props.setJornadaSettings) props.setJornadaSettings(parsed.jornadaSettings);
          if (parsed.customHolidays && props.setCustomHolidays) props.setCustomHolidays(parsed.customHolidays);
          if (parsed.deletedNationalHolidays && props.setDeletedNationalHolidays) props.setDeletedNationalHolidays(parsed.deletedNationalHolidays);
          if (parsed.monthNotes && props.setMonthNotes) props.setMonthNotes(parsed.monthNotes);
          if (parsed.trackingStartDate && props.setTrackingStartDate) props.setTrackingStartDate(parsed.trackingStartDate);
          if (parsed.protectedDaysMap && props.setProtectedDaysMap) props.setProtectedDaysMap(parsed.protectedDaysMap);
          await showDialog({ title: 'Sucesso', message: 'Backup restaurado com sucesso!' });
        }
      } catch {
        await showDialog({ title: 'Erro', message: 'Arquivo JSON inválido.' });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleUpdatePassword = async () => {
    if (!passForm.password.trim()) return;
    const ok = await showDialog({
      title: 'Alterar Senha',
      message: `Confirmar nova senha para ${passForm.role === 'admin' ? 'Gestor (Admin)' : 'Equipe (Viewer)'}?`,
      type: 'confirm',
    });
    if (!ok) return;
    setIsUpdatingPass(true);
    try {
      const res = await apiStore.updatePassword(passForm.role, passForm.password.trim());
      if (res.success) {
        setPassForm((p) => ({ ...p, password: '' }));
        await showDialog({ title: 'Sucesso', message: 'Senha atualizada na aba Config da planilha!' });
      } else {
        await showDialog({ title: 'Erro', message: res.error || 'Falha ao atualizar senha.' });
      }
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const handleVacuum = async () => {
    const ok = await showDialog({
      title: 'Otimizar Planilha',
      message: 'Remover linhas duplicadas antigas da planilha banco sem afetar os dados atuais?',
      type: 'confirm',
    });
    if (!ok) return;
    const res = await apiStore.vacuum();
    await showDialog({
      title: res.success ? 'Concluído' : 'Erro',
      message: res.success ? `Otimização concluída (${res.removedRows || 0} linhas antigas removidas).` : res.error || 'Falha ao otimizar.',
    });
  };

  return (
    <div className="max-w-3xl mx-auto mt-4 space-y-5">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-3xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Icon name="add_to_drive" className="text-2xl text-white" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-100">Banco Google Drive</p>
            <p className="text-base font-black">{driveInfo?.spreadsheetName || 'Rhescala - Banco de Dados'}</p>
            <p className="text-[11px] text-emerald-100 mt-0.5">
              Status: {props.syncStatus.state === 'syncing' ? 'Sincronizando...' : props.syncStatus.state === 'error' ? 'Erro de conexão' : 'Sincronizado'}
              {props.syncStatus.lastSync ? ` • ${props.syncStatus.lastSync}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {driveInfo?.spreadsheetUrl && (
            <a
              href={driveInfo.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5"
            >
              <Icon name="open_in_new" className="text-sm" />
              Abrir Planilha
            </a>
          )}
          {isGasEnvironment() && (
            <button
              onClick={handleSaveBackupToDrive}
              disabled={savingDrive}
              className="px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              <Icon name="cloud_upload" className="text-sm" />
              {savingDrive ? 'Salvando...' : 'Backup no Drive'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-orange-500">Senhas de Acesso</h3>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            {(['admin', 'viewer'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setPassForm((p) => ({ ...p, role: r }))}
                className={`flex-1 py-2 text-[11px] font-black uppercase rounded-lg ${
                  passForm.role === r ? 'bg-orange-500 text-white shadow' : 'text-zinc-500'
                }`}
              >
                {r === 'admin' ? 'Gestor (Admin)' : 'Equipe (Viewer)'}
              </button>
            ))}
          </div>
          <input
            type="password"
            placeholder="Nova senha..."
            value={passForm.password}
            onChange={(e) => setPassForm((p) => ({ ...p, password: e.target.value }))}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-bold outline-none focus:border-orange-500"
          />
          <button
            onClick={handleUpdatePassword}
            disabled={isUpdatingPass || !passForm.password.trim()}
            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black uppercase text-[11px] tracking-wider disabled:opacity-50"
          >
            {isUpdatingPass ? 'Atualizando...' : 'Salvar Nova Senha'}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Importar / Exportar / Manutenção</h3>
          <button
            onClick={handleExportLocalJson}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-[11px] tracking-wider flex items-center justify-center gap-2"
          >
            <Icon name="download" className="text-base" />
            Baixar Backup (.json)
          </button>
          {props.onExportScheduleCsv && (
            <button
              onClick={props.onExportScheduleCsv}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold uppercase text-[11px] tracking-wider flex items-center justify-center gap-2"
            >
              <Icon name="table_view" className="text-base" />
              Exportar Mês Atual (.csv)
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-bold uppercase text-[11px] tracking-wider flex items-center justify-center gap-2"
          >
            <Icon name="upload" className="text-base" />
            Restaurar Backup (.json)
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          <button
            onClick={handleVacuum}
            className="w-full py-2.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-xl font-bold uppercase text-[11px] tracking-wider flex items-center justify-center gap-2"
          >
            <Icon name="auto_fix_high" className="text-base" />
            Otimizar Planilha (Vacuum)
          </button>
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={props.onClose}
          className="px-6 py-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-xl text-xs font-black uppercase tracking-wider"
        >
          Voltar para a Grade
        </button>
      </div>
    </div>
  );
};
