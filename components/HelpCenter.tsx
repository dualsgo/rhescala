
import React, { useState } from 'react';
import { Icon } from './Icon';

interface HelpCenterProps {
  onClose: () => void;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'guide'>('faq');

  const faqs = [
    {
      q: 'Como começar uma nova escala?',
      a: 'Clique no botão "Editar" > "Criar Mês (Gerar)". O sistema irá criar automaticamente os dias do mês selecionado e aplicar as regras básicas de folga.'
    },
    {
      q: 'Qual a diferença entre Folga Fixa e Sorteio?',
      a: 'A Folga Fixa é o dia que o colaborador folga TODA semana (ex: Segunda). O Sorteio de Domingos é rotativo, garantindo que todos descansem conforme a legislação.'
    },
    {
      q: 'Como exportar para a equipe?',
      a: 'Você pode usar o botão "Imprimir" para gerar um PDF profissional ou o botão "Copiar Texto" para enviar o posicionamento do dia via WhatsApp.'
    },
    {
      q: 'O que significa cada sigla (P1, P2, etc)?',
      a: 'P1: Caixa/Abertura, P2: Porta, P3: Salão, P4: Flexível/Apoio, ESTQ: Estoque. Você pode mudar essas posições clicando em "Distribuir Posições".'
    },
    {
      q: 'Como configurar feriados?',
      a: 'Vá em Configurações > Feriados. Lá você pode adicionar feriados municipais. Feriados nacionais já são incluídos automaticamente pelo sistema.'
    }
  ];

  const guideSteps = [
    { title: '1. Equipe', desc: 'Cadastre todos os colaboradores e defina seus cargos (Vendedor, Estoquista, Aprendiz).', icon: 'groups' },
    { title: '2. Jornada', desc: 'Configure os horários padrão de abertura, fechamento e almoço em Configurações > Jornada.', icon: 'schedule' },
    { title: '3. Gerar Mês', desc: 'Na grade, clique em Editar > Criar Mês para inicializar o calendário.', icon: 'auto_awesome' },
    { title: '4. Ajustar', desc: 'Use o "Sorteio de Domingos" e ajuste folgas manuais se necessário.', icon: 'edit_calendar' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <Icon name="help" className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase text-slate-800 dark:text-slate-100 tracking-tight">Central de Ajuda</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suporte ao Usuário Rhescala</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button 
            onClick={() => setActiveTab('faq')}
            className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'faq' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}
          >
            Perguntas Frequentes
          </button>
          <button 
            onClick={() => setActiveTab('guide')}
            className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'guide' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}
          >
            Guia Rápido
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
          {activeTab === 'faq' ? (
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-orange-200 dark:hover:border-orange-900 group">
                  <h4 className="text-[12px] font-black text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-[10px]">Q</span>
                    {faq.q}
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed pl-7">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guideSteps.map((step, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 mb-4">
                    <Icon name={step.icon} className="text-lg" />
                  </div>
                  <h4 className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-100 mb-1">{step.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 leading-normal">{step.desc}</p>
                </div>
              ))}
              <div className="md:col-span-2 mt-4 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl">
                 <p className="text-[10px] font-bold text-orange-600 uppercase flex items-center gap-2">
                   <Icon name="info" /> Dica: Passe o mouse sobre os ícones para ver descrições detalhadas.
                 </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
          >
            Entendi, vamos lá!
          </button>
        </div>

      </div>
    </div>
  );
};
