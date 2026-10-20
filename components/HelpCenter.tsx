import React, { useState } from 'react';
import { Icon } from './Icon';

interface HelpCenterProps {
  onClose: () => void;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ onClose }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  const [activeTab, setActiveTab] = useState<'posicoes' | 'funcoes' | 'legenda'>('posicoes');

  const tacticalPositions = [
    {
      code: 'CX',
      posCode: 'P1',
      name: 'Caixa (CX)',
      color: 'bg-red-600 text-white',
      badgeBg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50',
      icon: 'point_of_sale',
      desc: 'Responsável principal pela abertura do caixa, atendimento no checkout, organização do balcão, conferência de sangrias e fundo de troco.',
      responsibilities: [
        'Abertura e fechamento de caixa com conferência rigorosa',
        'Atendimento ágil, cordial e registro correto de produtos',
        'Oferta de produtos de impulso / itens de frente de caixa',
        'Emissão de cupons fiscais e suporte em trocas com nota'
      ]
    },
    {
      code: 'PC',
      posCode: 'P1',
      name: 'Pacote (PC)',
      color: 'bg-orange-500 text-white',
      badgeBg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/50',
      icon: 'inventory_2',
      desc: 'Foco no empacotamento de presentes com excelência, organização de fitas e embalagens e suporte direto à fluidez do caixa.',
      responsibilities: [
        'Embalagem cuidadosa de presentes e colocação de laços padrão Ri Happy',
        'Manutenção do suprimento de sacolas e papéis de presente',
        'Auxílio ao operador de caixa na conferência de itens frágeis',
        'Agilização da fila em horários de pico'
      ]
    },
    {
      code: 'REP',
      posCode: 'P2',
      name: 'Apoio / Reposição (AP)',
      color: 'bg-amber-500 text-white',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
      icon: 'inventory',
      desc: 'Organização e reposição contínua do salão de vendas, frenteamento das gôndolas, precificação correta e suporte à entrada da loja.',
      responsibilities: [
        'Reposição contínua e alinhamento de gôndolas (frenteamento)',
        'Organização de corredores, cestos e recolhimento de devoluções',
        'Conferência de precificação e etiquetagem correta dos brinquedos',
        'Suporte visual e organização das pontas de gôndola e ilhas'
      ]
    },
    {
      code: 'VEND',
      posCode: 'P3',
      name: 'Vendas / Atendimento (VEND)',
      color: 'bg-emerald-600 text-white',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50',
      icon: 'toys',
      desc: 'Atendimento ativo, consultoria aos clientes, demonstração de brinquedos e encantamento de crianças e famílias no salão.',
      responsibilities: [
        'Abordagem consultiva e encantamento de crianças e famílias',
        'Demonstração interativa de lançamentos e produtos em destaque',
        'Atendimento às dúvidas dos clientes e suporte na escolha de presentes',
        'Venda assistida em todos os setores da loja'
      ]
    },
    {
      code: 'FISC',
      posCode: 'FISC',
      name: 'Fiscal de Loja & Prevenção',
      color: 'bg-blue-600 text-white',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50',
      icon: 'shield_person',
      desc: 'Porta de entrada, recepção dos clientes, prevenção de perdas, monitoramento do fluxo de salão e suporte operacional geral.',
      responsibilities: [
        'Boas-vindas acolhedoras aos clientes e direcionamento no salão',
        'Monitoramento atento de pontos cegos e prevenção de perdas',
        'Conferência de mercadorias e suporte à segurança da unidade',
        'Comunicação rápida com a liderança sobre movimentações atípicas'
      ]
    },
    {
      code: 'ESTQ',
      posCode: 'ESTQ',
      name: 'Estoque / Depósito & Abastecimento',
      color: 'bg-slate-700 text-white',
      badgeBg: 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/50',
      icon: 'pallet',
      desc: 'Gestão do depósito de mercadorias, conferência de notas fiscais de entrada, separação de pedidos e abastecimento do salão de vendas.',
      responsibilities: [
        'Recebimento de carretas/entregas e conferência física com nota',
        'Triagem, etiquetagem e endereçamento no estoque',
        'Separação diária de itens para reposição no salão',
        'Controle de avarias e preparação para trocas com fornecedores'
      ]
    }
  ];

  const rolesGuide = [
    {
      cargo: 'Atendente / Vendedor',
      icon: 'shopping_bag',
      color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/40',
      desc: 'Linha de frente da loja, responsável pelo encantamento, venda de brinquedos, cumprimento de metas e excelente experiência do cliente.'
    },
    {
      cargo: 'Estoquista',
      icon: 'inventory',
      color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700',
      desc: 'Guardião da integridade do estoque, organização do depósito, abastecimento contínuo e logística reversa de mercadorias.'
    },
    {
      cargo: 'Fiscal de Salão',
      icon: 'verified_user',
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40',
      desc: 'Garante a segurança do patrimônio, organização da entrada e suporte preventivo para uma operação tranquila e sem desvios.'
    },
    {
      cargo: 'Jovem Aprendiz',
      icon: 'school',
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/40',
      desc: 'Jornada especial de 6h (15 min de intervalo). Proibido trabalhar aos sábados, domingos e feriados, com folga obrigatória no dia de curso teórico.'
    }
  ];

  const shiftLegend = [
    { code: 'T / DOM', label: 'Trabalho Normal / Domingo', desc: 'Dia de trabalho regular conforme o horário cadastrado da escala.', bg: 'bg-indigo-600 text-white' },
    { code: 'F', label: 'Folga Semanal', desc: 'Descanso Semanal Remunerado (DSR) regular do colaborador.', bg: 'bg-rose-500 text-white' },
    { code: 'FF', label: 'Folga Feriado', desc: 'Compensação por feriado trabalhado (crédito adquirido).', bg: 'bg-red-600 text-white' },
    { code: 'FE', label: 'Férias', desc: 'Período oficial de descanso anual remunerado.', bg: 'bg-purple-600 text-white' },
    { code: 'DO', label: 'Day Off (Aniversário)', desc: 'Folga comemorativa concedida no dia de aniversário.', bg: 'bg-fuchsia-600 text-white' },
    { code: 'AT', label: 'Atestado Médico', desc: 'Ausência justificada por atestado médico homologado.', bg: 'bg-rose-700 text-white' },
    { code: 'C', label: 'Curso / Teórico', desc: 'Dia destinado ao curso de capacitação do Jovem Aprendiz.', bg: 'bg-teal-600 text-white' },
    { code: 'N/A', label: 'Não Vigente', desc: 'Data anterior à admissão ou posterior ao desligamento.', bg: 'bg-slate-400 text-white' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <Icon name="badge" className="text-xl" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase text-slate-800 dark:text-slate-100 tracking-tight">
                Guia de Funções (Correlatas)
              </h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Ri Happy Shift Management • Padrões Operacionais
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setActiveTab('posicoes')}
            className={`px-4 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'posicoes' 
                ? 'border-orange-500 text-orange-600 dark:text-orange-400' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon name="badge" className="text-sm" />
            Funções (Correlatas)
          </button>
          <button 
            onClick={() => setActiveTab('funcoes')}
            className={`px-4 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'funcoes' 
                ? 'border-orange-500 text-orange-600 dark:text-orange-400' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon name="groups" className="text-sm" />
            Cargos & Funções
          </button>
          <button 
            onClick={() => setActiveTab('legenda')}
            className={`px-4 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'legenda' 
                ? 'border-orange-500 text-orange-600 dark:text-orange-400' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon name="format_list_bulleted" className="text-sm" />
            Legenda de Turnos
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-slate-50/40 dark:bg-zinc-950/40 space-y-4">
          
          {/* Aba 1: Posições Táticas */}
          {activeTab === 'posicoes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {tacticalPositions.map(pos => (
                <div 
                  key={pos.code} 
                  className={`p-4 rounded-2xl border ${pos.badgeBg} flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm ${pos.color}`}>
                          {pos.code}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                          {pos.name}
                        </h4>
                      </div>
                      <Icon name={pos.icon} className="text-lg text-slate-400" />
                    </div>

                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      {pos.desc}
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-black/5 dark:border-white/5">
                      <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest block">
                        Principais Atividades:
                      </span>
                      {pos.responsibilities.map((r, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                          <span className="text-orange-500 font-bold">•</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aba 2: Cargos & Funções */}
          {activeTab === 'funcoes' && (
            <div className="space-y-4 animate-fade-in">
              {rolesGuide.map((item, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border ${item.color} flex items-start gap-3 shadow-sm`}>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 shadow-sm shrink-0 mt-0.5">
                    <Icon name={item.icon} className="text-xl" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight">
                      {item.cargo}
                    </h4>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aba 3: Legenda de Turnos */}
          {activeTab === 'legenda' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
              {shiftLegend.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-700/60 flex items-start gap-3 shadow-sm">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${item.bg}`}>
                    {item.code}
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-100 tracking-tight">
                      {item.label}
                    </h5>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all shadow-md"
          >
            Fechar Guia
          </button>
        </div>

      </div>
    </div>
  );
};
