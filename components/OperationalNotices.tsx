
import React from 'react';
import { Icon } from './Icon';
import { toPng } from 'html-to-image';

interface OperationalNoticesProps {
  onClose: () => void;
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const OperationalNotices: React.FC<OperationalNoticesProps> = ({ onClose }) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();
  const monthName = MONTH_NAMES[today.getMonth()];
  
  const handleDownload = async () => {
    const el = document.getElementById('notices-capture');
    if (el) {
      const dataUrl = await toPng(el, { 
        backgroundColor: '#f8fafc',
        pixelRatio: 3,
        width: 800,
        style: {
            padding: '0',
            margin: '0'
        }
      });
      const link = document.createElement('a');
      link.download = `comunicado-operacional-${today.toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const getDayActivities = (dow: number) => {
    switch(dow) {
      case 1: return ['Repor mesa de ofertas', 'Lista Obsolescência', 'Abastecer Geral'];
      case 2: return ['Super tático'];
      case 3: return ['Preparar ofertas'];
      case 4: return ['Conferir mesa de ofertas', 'Divulgar ofertas', 'Preparar evento de sexta'];
      case 5: return ['Live e eventos', 'Preparar evento de sábado'];
      case 6: return ['Happy Sábado'];
      case 0: return ['Alteração preços mesa de ofertas'];
      default: return [];
    }
  };

  const getChecklists = (dow: number) => {
    const checklists = [];
    if (dow >= 1 && dow <= 3) checklists.push('Checklist Agenda Líder');
    if (dow === 4) checklists.push('Checklist Bate Meta');
    if (dow >= 1 && dow <= 5) checklists.push('Checklist Jornada do Brincar');
    return checklists;
  };

  const activities = getDayActivities(dayOfWeek);
  const checklists = getChecklists(dayOfWeek);

  return (
    <div className="flex flex-col h-full animate-fade-in bg-slate-100 dark:bg-slate-950 p-6 overflow-hidden">
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full gap-6">
        
        {/* Top Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="campaign" />
             </div>
             <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Comunicado Operacional Diário</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
            >
              <Icon name="download" /> Baixar Imagem (WhatsApp)
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
              <Icon name="close" className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto custom-scrollbar rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800">
          <div id="notices-capture" className="bg-slate-50 w-full min-h-[1000px] p-8 lg:p-16 flex flex-col gap-10">
            
            {/* Header Design */}
            <div className="relative overflow-hidden bg-indigo-600 rounded-[3.5rem] p-12 text-white shadow-xl">
               <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 rounded-full -ml-32 -mb-32 blur-2xl"></div>
               <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.5em] opacity-80 mb-3">Ri Happy • Operação Padrão</p>
                    <h1 className="text-6xl font-black uppercase tracking-tighter leading-[0.9] mb-0">Mural de<br/>Recados</h1>
                  </div>
                  <div className="inline-flex items-center gap-4 px-6 py-3 bg-white/15 backdrop-blur-xl rounded-2xl border border-white/20 shadow-inner">
                    <Icon name="calendar_today" className="text-xl" />
                    <span className="text-base font-black uppercase tracking-widest">{WEEKDAY_NAMES[dayOfWeek]}, {dayOfMonth} de {monthName}</span>
                  </div>
               </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Destaques e Atividades */}
              <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm flex flex-col gap-8">
                <div className="flex items-center gap-4 text-indigo-600">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <Icon name="stars" className="text-2xl" />
                  </div>
                  <h3 className="text-base font-black uppercase tracking-widest">Destaques do Dia</h3>
                </div>
                <div className="flex flex-col gap-4">
                  {activities.map((act, i) => (
                    <div key={i} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 group hover:bg-indigo-50 hover:border-indigo-100 transition-all">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>
                      <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{act}</span>
                    </div>
                  ))}
                  {activities.length === 0 && <p className="text-slate-400 font-bold italic">Nenhuma atividade extraordinária para hoje.</p>}
                </div>
              </div>

              {/* Checklists do Dia */}
              <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm flex flex-col gap-8">
                <div className="flex items-center gap-4 text-emerald-600">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                    <Icon name="fact_check" className="text-2xl" />
                  </div>
                  <h3 className="text-base font-black uppercase tracking-widest">Checklists Obrigatórios</h3>
                </div>
                <div className="flex flex-col gap-4">
                  {checklists.map((chk, i) => (
                    <div key={i} className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center gap-5">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                        <Icon name="check_circle" className="text-xl" />
                      </div>
                      <span className="text-sm font-black text-emerald-900 uppercase tracking-tight">{chk}</span>
                    </div>
                  ))}
                  {checklists.length === 0 && <p className="text-slate-400 font-bold italic">Sem checklists obrigatórios para hoje.</p>}
                </div>
              </div>

              {/* Regras Operacionais Fixo (Width full span in grid if needed, or stay side-by-side) */}
              <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm flex flex-col gap-6">
                <div className="flex items-center gap-4 text-amber-600">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                    <Icon name="cleaning_services" className="text-2xl" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Copa e Limpeza</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3 p-4 bg-amber-50/30 rounded-2xl border border-amber-100/50">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0"></div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase tracking-tight">Janela de limpeza: <b>14h às 18h</b> (baixo fluxo)</p>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-amber-50/30 rounded-2xl border border-amber-100/50">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0"></div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase tracking-tight">Segurança: Mínimo de <b>3 pessoas</b> na loja</p>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-amber-50/30 rounded-2xl border border-amber-100/50">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0"></div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase tracking-tight">Regra Coletiva: <b>Quem sujou, lavou</b></p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm flex flex-col gap-6">
                <div className="flex items-center gap-4 text-rose-600">
                  <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                    <Icon name="shield" className="text-2xl" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Funções & Atribuições da Equipe</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3 p-4 bg-rose-50/30 rounded-2xl border border-rose-100/50">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0"></div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase tracking-tight"><b>Fiscais:</b> Prioridade na <b>Porta e Prevenção</b></p>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-rose-50/30 rounded-2xl border border-rose-100/50">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0"></div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase tracking-tight"><b>Estoquistas:</b> Foco operacional no <b>ESTQ (Estoque)</b></p>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-rose-50/30 rounded-2xl border border-rose-100/50">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0"></div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase tracking-tight"><b>Essenciais:</b> Caixa e Reposição devem estar sempre ativos</p>
                  </div>
                </div>
              </div>

              {/* Motivacional / Rodapé */}
              <div className="lg:col-span-2 mt-4 p-12 bg-slate-900 rounded-[4rem] text-center relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/30 to-transparent"></div>
                <div className="relative z-10">
                  <div className="flex justify-center gap-3 mb-4">
                     {[1,2,3,4,5].map(i => <Icon key={i} name="star" className="text-amber-400 text-2xl" />)}
                  </div>
                  <h4 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 italic">Excelente Trabalho a Todos!</h4>
                  <p className="text-xs font-black text-indigo-300 uppercase tracking-[0.6em] mt-4">DNA Ri Happy • Excelência no Atendimento</p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
