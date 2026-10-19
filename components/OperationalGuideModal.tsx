import React from 'react';
import { Icon } from './Icon';

interface OperationalGuideModalProps {
  onClose: () => void;
}

export const OperationalGuideModal: React.FC<OperationalGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100 dark:border-zinc-800 bg-orange-500 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Icon name="menu_book" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Manual de Boas Práticas</h2>
              <p className="text-xs md:text-sm font-bold opacity-90">Modelo Operacional e Funções da Equipe</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <Icon name="close" className="text-2xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-50 dark:bg-zinc-950">
          
          <div className="bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Icon name="priority_high" className="text-rose-600 dark:text-rose-400 text-2xl" />
              <h3 className="text-lg font-black text-rose-700 dark:text-rose-400 uppercase tracking-tight">Regra de Ouro</h3>
            </div>
            <p className="text-rose-900 dark:text-rose-200 font-bold leading-relaxed">
              Na "Zona Vermelha" (loja aberta das 11h às 21h15), <strong>o cliente tem prioridade absoluta</strong>. Qualquer atividade operacional ou de arrumação deve ser interrompida imediatamente caso um cliente precise de atendimento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Caixa / Pacote (P1) */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🟥</span>
                <div>
                  <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Caixa (CX)</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Âncora de Finalização</p>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-zinc-300 font-bold">
                <li><strong className="text-slate-800 dark:text-white">Tempo Ocioso:</strong> Nunca ficar parado. Adiantar a produção de saquinhos de presente (Pacote Rápido) e alinhar produtos próximos ao balcão.</li>
                <li><strong className="text-slate-800 dark:text-white">Cobertura:</strong> Fixo no fundo da loja. É proibido abandonar o balcão ou ir para o estoque (exceto se houver apoio, permitindo suporte ao salão).</li>
                <li><strong className="text-slate-800 dark:text-white">Rendição:</strong> O Caixa/Pacote Fechamento rende o almoço da Abertura. Quando o de Abertura volta, assume o Caixa (prioridade) e o de Fechamento atua no Salão/Vendas.</li>
              </ul>
            </div>

            {/* Reposição / Organização (P2) */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🟨</span>
                <div>
                  <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Apoio / Reposição (AP)</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtro, Entrada & Gôndolas</p>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-zinc-300 font-bold">
                <li><strong className="text-slate-800 dark:text-white">Foco Total:</strong> Proibido uso de celular ou rodinhas de conversa. Foco no fluxo e frenteamento. Recepciona e direciona para Vendas/Atendimento livre.</li>
                <li><strong className="text-slate-800 dark:text-white">Acionamento (Sino):</strong> É o responsável por tocar o Sino de Ajuda em ondas de clientes.</li>
                <li><strong className="text-slate-800 dark:text-white">Apoio:</strong> Só abandona o salão/porta em emergência extrema (3º nível de apoio ao caixa). Quando a fila reduz, volta imediatamente.</li>
              </ul>
            </div>

            {/* Vendas / Atendimento (P3) */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🟩</span>
                <div>
                  <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Vendas (VEND)</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salão / Consultor de Loja</p>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-zinc-300 font-bold">
                <li><strong className="text-slate-800 dark:text-white">Tempo Ocioso:</strong> Executar puxada de frente, organização e precificação APENAS se não houver clientes. Viu cliente? Prioridade absoluta ao atendimento.</li>
                <li><strong className="text-slate-800 dark:text-white">Múltiplos Consultores:</strong> Se houver mais de um, ocupem setores opostos para garantir cobertura total da loja.</li>
                <li><strong className="text-slate-800 dark:text-white">Apoio (2º Nível):</strong> Se a fila do caixa crescer e o Fiscal/Apoio estiver ocupado, Vendas deve abrir um novo PDV.</li>
              </ul>
            </div>

            {/* Fiscal / Suporte (P4) */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🟦</span>
                <div>
                  <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Fiscal (FISC)</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prevenção & Apoio Flexível</p>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-zinc-300 font-bold">
                <li><strong className="text-slate-800 dark:text-white">Tempo Ocioso:</strong> Foca no atendimento digital (WhatsApp da loja) e fiscalização de prevenção. Auxilia no abastecimento se não houver clientes.</li>
                <li><strong className="text-slate-800 dark:text-white">Coringa da Equipe:</strong> Alta mobilidade, posiciona-se onde houver vácuo de atendimento ou prevenção.</li>
                <li><strong className="text-slate-800 dark:text-white">Apoio Imediato (1º Nível):</strong> Sino tocou ou fila formou? Larga tarefas secundárias imediatamente e assume o 2º caixa ou balcão de pacotes.</li>
              </ul>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="sync_alt" className="text-indigo-600 dark:text-indigo-400 text-2xl" />
              <h3 className="text-lg font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">A Dança de Cobertura</h3>
            </div>
            <p className="text-indigo-900 dark:text-indigo-200 font-bold mb-4 text-sm">
              Para o sistema fluir de forma inteligente, o deslocamento da equipe para ajudar o caixa e o retorno às funções de salão devem seguir uma ordem cirúrgica:
            </p>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Ida para o Caixa (Cobrir Filas)</p>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-300">
                  <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 px-2 py-1 rounded">1º Fiscal</span>
                  <Icon name="arrow_forward" className="text-slate-400" />
                  <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-2 py-1 rounded">2º Vendas</span>
                  <Icon name="arrow_forward" className="text-slate-400" />
                  <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-1 rounded">3º Reposição</span>
                </div>
              </div>
              <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Retorno ao Salão (Fim da Fila)</p>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-300">
                  <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-1 rounded">1º Reposição</span>
                  <Icon name="arrow_forward" className="text-slate-400" />
                  <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-2 py-1 rounded">2º Vendas</span>
                  <Icon name="arrow_forward" className="text-slate-400" />
                  <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 px-2 py-1 rounded">3º Fiscal</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
