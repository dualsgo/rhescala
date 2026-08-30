import React, { useState, useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { Icon } from './Icon';
import { getShortName, isEmployeeActiveInMonth, buildHolidaySet } from '../constants';
import { toPng } from 'html-to-image';

export interface OutlierSale {
  id: string;
  day: number;
  dateStr: string;
  employeeId: string;
  employeeName: string;
  itemsCount: number;
  totalValue: number;
  description: string;
  isExpurgated: boolean;
  isManual?: boolean;
}

interface WhatIfSalesSimulatorProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
}

const PRESET_THRESHOLDS = [
  { label: 'Bruto (Sem Expurgo)', value: 0 },
  { label: 'Corte ≥ 6 itens', value: 6 },
  { label: 'Corte ≥ 8 itens', value: 8 },
  { label: 'Corte ≥ 10 itens', value: 10 },
  { label: 'Corte ≥ 15 itens', value: 15 },
  { label: 'Corte ≥ 20 itens', value: 20 },
];

const DEFAULT_DESCRIPTIONS = [
  'Sacolinha de Aniversário (Brindes infantis)',
  'Compra Corporativa (Dia das Crianças)',
  'Lembrancinhas Festa Escolar',
  'Doação de Brinquedos de Natal',
  'Compra em Lote de Miniaturas/Colecionáveis',
  'Atacado Evento Infantil',
  'Kits de Festa e Acessórios'
];

export const WhatIfSalesSimulator: React.FC<WhatIfSalesSimulatorProps> = ({
  employees,
  currentMY,
  customHolidays
}) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const activeEmployees = useMemo(() => {
    return employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
  }, [employees, currentMY]);

  // Generate initial realistic sample outlier sales tailored to active employees in current month
  const initialOutliers = useMemo<OutlierSale[]>(() => {
    if (activeEmployees.length === 0) return [];
    
    const sampleDays = [4, 7, 11, 14, 18, 22, 25, 28];
    const sampleItems = [12, 18, 8, 25, 34, 14, 45, 10];
    const sampleValues = [480, 890, 320, 1450, 2100, 720, 3200, 510];

    return sampleDays
      .filter(d => d <= daysInMonth)
      .map((day, idx) => {
        const emp = activeEmployees[idx % activeEmployees.length];
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const items = sampleItems[idx % sampleItems.length];
        const val = sampleValues[idx % sampleValues.length];
        const desc = DEFAULT_DESCRIPTIONS[idx % DEFAULT_DESCRIPTIONS.length];

        return {
          id: `outlier-${monthKey}-${day}-${idx}`,
          day,
          dateStr,
          employeeId: emp.id,
          employeeName: emp.name,
          itemsCount: items,
          totalValue: val,
          description: desc,
          isExpurgated: true, // Default to expurgated for impact test
          isManual: false
        };
      });
  }, [activeEmployees, daysInMonth, monthKey, currentMY]);

  const [outlierSales, setOutlierSales] = useState<OutlierSale[]>(initialOutliers);
  const [selectedThreshold, setSelectedThreshold] = useState<number>(8);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Form state for adding manual sale
  const [newSaleDay, setNewSaleDay] = useState<number>(1);
  const [newSaleEmpId, setNewSaleEmpId] = useState<string>(activeEmployees[0]?.id || '');
  const [newSaleItems, setNewSaleItems] = useState<number>(20);
  const [newSaleValue, setNewSaleValue] = useState<number>(1000);
  const [newSaleDesc, setNewSaleDesc] = useState<string>('Compra Atípica / Lote Especial');

  // Baseline store sales volume (realistic retail toy store distribution: ~70 tickets/day, PA ~2.4)
  const baselineDailyData = useMemo(() => {
    const data: Record<number, { baseTickets: number; baseItems: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentMY.year, currentMY.month, d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isHoliday = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      
      // Base tickets & items depending on day traffic
      const baseTickets = isWeekend || isHoliday ? 95 : 55;
      const basePA = isWeekend ? 2.38 : 2.25;
      const baseItems = Math.round(baseTickets * basePA);

      data[d] = { baseTickets, baseItems };
    }
    return data;
  }, [daysInMonth, currentMY, holidaySet]);

  // Apply automatic threshold to outlier sales
  const handleApplyThreshold = (threshold: number) => {
    setSelectedThreshold(threshold);
    if (threshold === 0) {
      // Uncheck all
      setOutlierSales(prev => prev.map(s => ({ ...s, isExpurgated: false })));
    } else {
      // Check all with items >= threshold
      setOutlierSales(prev => prev.map(s => ({
        ...s,
        isExpurgated: s.itemsCount >= threshold
      })));
    }
  };

  // Toggle single sale expurgation manually
  const handleToggleSingleSale = (saleId: string) => {
    setOutlierSales(prev => prev.map(s => {
      if (s.id === saleId) {
        return { ...s, isExpurgated: !s.isExpurgated };
      }
      return s;
    }));
  };

  // Add manual sale
  const handleAddManualSale = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = activeEmployees.find(emp => emp.id === newSaleEmpId) || activeEmployees[0];
    if (!emp) return;

    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(newSaleDay).padStart(2, '0')}`;
    const newSale: OutlierSale = {
      id: `manual-sale-${Date.now()}`,
      day: newSaleDay,
      dateStr,
      employeeId: emp.id,
      employeeName: emp.name,
      itemsCount: Number(newSaleItems) || 1,
      totalValue: Number(newSaleValue) || 0,
      description: newSaleDesc || 'Venda Manual Adicionada',
      isExpurgated: selectedThreshold === 0 ? false : (Number(newSaleItems) >= selectedThreshold),
      isManual: true
    };

    setOutlierSales(prev => [newSale, ...prev]);
    setIsAddModalOpen(false);
  };

  // Remove manual sale
  const handleRemoveSale = (saleId: string) => {
    setOutlierSales(prev => prev.filter(s => s.id !== saleId));
  };

  // ─── Metrics Calculation ───────────────────────────────────────────────────

  const simulationResults = useMemo(() => {
    let totalBaseTickets = 0;
    let totalBaseItems = 0;

    Object.values(baselineDailyData).forEach(d => {
      totalBaseTickets += d.baseTickets;
      totalBaseItems += d.baseItems;
    });

    // Outlier totals
    const totalOutliersTickets = outlierSales.length;
    const totalOutliersItems = outlierSales.reduce((acc, s) => acc + s.itemsCount, 0);
    const totalOutliersValue = outlierSales.reduce((acc, s) => acc + s.totalValue, 0);

    // Gross totals (Base + All Outliers)
    const grossTickets = totalBaseTickets + totalOutliersTickets;
    const grossItems = totalBaseItems + totalOutliersItems;
    const grossPA = grossTickets > 0 ? (grossItems / grossTickets) : 0;

    // Expurgated totals (Only those marked for expurgation)
    const expurgatedSales = outlierSales.filter(s => s.isExpurgated);
    const expurgatedTickets = expurgatedSales.length;
    const expurgatedItems = expurgatedSales.reduce((acc, s) => acc + s.itemsCount, 0);
    const expurgatedValue = expurgatedSales.reduce((acc, s) => acc + s.totalValue, 0);

    // Sustained (Liquid) totals
    const netTickets = Math.max(1, grossTickets - expurgatedTickets);
    const netItems = Math.max(1, grossItems - expurgatedItems);
    const netPA = netTickets > 0 ? (netItems / netTickets) : 0;

    // Deltas
    const deltaPA = netPA - grossPA;
    const deltaPAPercent = grossPA > 0 ? (deltaPA / grossPA) * 100 : 0;

    // Outlier Dependency Index
    const dependencyRate = grossItems > 0 ? (expurgatedItems / grossItems) * 100 : 0;

    return {
      grossTickets,
      grossItems,
      grossPA: grossPA.toFixed(2),
      grossPANum: grossPA,
      expurgatedTickets,
      expurgatedItems,
      expurgatedValue,
      netTickets,
      netItems,
      netPA: netPA.toFixed(2),
      netPANum: netPA,
      deltaPA: deltaPA.toFixed(2),
      deltaPAPercent: deltaPAPercent.toFixed(1),
      dependencyRate: dependencyRate.toFixed(1),
      totalOutliersCount: outlierSales.length,
      activeExpurgatedCount: expurgatedSales.length
    };
  }, [baselineDailyData, outlierSales]);

  // Per-Employee Impact Breakdown
  const employeeImpact = useMemo(() => {
    return activeEmployees.map(emp => {
      const empOutliers = outlierSales.filter(s => s.employeeId === emp.id);
      const totalOutlierItems = empOutliers.reduce((acc, s) => acc + s.itemsCount, 0);
      const totalOutlierTickets = empOutliers.length;

      // Base share per employee
      const empBaseTickets = Math.round((simulationResults.grossTickets - outlierSales.length) / Math.max(1, activeEmployees.length));
      const empBaseItems = Math.round(empBaseTickets * 2.35);

      const empGrossTickets = empBaseTickets + totalOutlierTickets;
      const empGrossItems = empBaseItems + totalOutlierItems;
      const empGrossPA = empGrossTickets > 0 ? (empGrossItems / empGrossTickets) : 0;

      const empExpurgated = empOutliers.filter(s => s.isExpurgated);
      const expItems = empExpurgated.reduce((acc, s) => acc + s.itemsCount, 0);
      const expTickets = empExpurgated.length;

      const empNetTickets = Math.max(1, empGrossTickets - expTickets);
      const empNetItems = Math.max(1, empGrossItems - expItems);
      const empNetPA = empNetTickets > 0 ? (empNetItems / empNetTickets) : 0;

      const delta = empNetPA - empGrossPA;

      return {
        id: emp.id,
        name: emp.name,
        cargo: emp.cargo || 'Atendente',
        grossPA: empGrossPA.toFixed(2),
        netPA: empNetPA.toFixed(2),
        delta: delta.toFixed(2),
        outliersCount: totalOutlierTickets,
        expurgatedCount: expTickets,
        expurgatedItems: expItems,
        isHeavilyInflated: Math.abs(delta) >= 0.35
      };
    }).sort((a, b) => parseFloat(b.netPA) - parseFloat(a.netPA));
  }, [activeEmployees, outlierSales, simulationResults.grossTickets]);

  const handleExportPng = async () => {
    const el = document.getElementById('what-if-capture-area');
    if (!el) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: { padding: '24px', borderRadius: '32px' }
      });
      const link = document.createElement('a');
      link.download = `simulador-whatif-pa-${monthKey}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Falha ao exportar relatório what-if:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div id="what-if-capture-area" className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      
      {/* ── Header Card ── */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 lg:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-wider text-indigo-200 border border-white/10">
                Simulador de Cenários What-If
              </span>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-500/30">
                Expurgo de Vendas com Muitos Itens
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight">
              Impacto de Outliers no P.A. (Peças por Atendimento)
            </h2>
            <p className="text-xs lg:text-sm font-medium text-indigo-200/90 mt-1 leading-relaxed">
              Teste o impacto de vendas volumosas (sacolinhas de aniversário, atacado, brindes escolares) e descubra o verdadeiro P.A. orgânico sustentado pela equipe.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white transition-all shadow-md active:scale-95"
            >
              <Icon name="add" className="text-sm" /> Adicionar Venda Manual
            </button>
            <button
              onClick={handleExportPng}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Icon name="download" className="text-sm" />
              {isExporting ? 'Exportando...' : 'Exportar Cenário PNG'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Comparative Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: P.A. Bruto vs P.A. Sustentado */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              P.A. Médio da Loja
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              <Icon name="analytics" className="text-xl" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Bruto</span>
                <span className="text-2xl font-black text-slate-400 line-through">{simulationResults.grossPA}</span>
              </div>
              <Icon name="arrow_forward" className="text-slate-300 text-sm" />
              <div>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase block">Sustentado</span>
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{simulationResults.netPA}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <Icon name="trending_down" className="text-sm" />
              <span>Variação: {simulationResults.deltaPA} ({simulationResults.deltaPAPercent}%)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Peças Expurgadas */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              Peças em Outliers
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
              <Icon name="shopping_bag" className="text-xl" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">
              {simulationResults.expurgatedItems.toLocaleString('pt-BR')} <span className="text-sm font-bold text-slate-400">peças</span>
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
              Em {simulationResults.expurgatedTickets} vendas volumosas (R$ {simulationResults.expurgatedValue.toLocaleString('pt-BR')})
            </p>
          </div>
        </div>

        {/* Card 3: Índice de Dependência */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              Dependência de Outliers
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black">
              <Icon name="pie_chart" className="text-xl" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">
              {simulationResults.dependencyRate}%
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
              {parseFloat(simulationResults.dependencyRate) > 15
                ? '🔴 Alta dependência de vendas atípicas'
                : parseFloat(simulationResults.dependencyRate) > 5
                  ? '🟡 Impacto moderado no resultado'
                  : '🟢 P.A. 100% orgânico e saudável'}
            </p>
          </div>
        </div>

        {/* Card 4: Volume Total Sustentado */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              Atendimentos Sustentados
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <Icon name="storefront" className="text-xl" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">
              {simulationResults.netTickets.toLocaleString('pt-BR')} <span className="text-sm font-bold text-slate-400">cupons</span>
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
              Totalizando {simulationResults.netItems.toLocaleString('pt-BR')} peças orgânicas no mês
            </p>
          </div>
        </div>

      </div>

      {/* ── Control Toolbar: Automated Threshold & Manual Filter ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Icon name="tune" className="text-indigo-600" /> Régua de Sensibilidade de Expurgo (Automático)
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Escolha um patamar de corte para expurgar automaticamente vendas que excedem a quantidade de itens
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApplyThreshold(0)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-all"
            >
              Restaurar Todas
            </button>
            <button
              onClick={() => handleApplyThreshold(1)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all"
            >
              Expurgar Todas ({outlierSales.length})
            </button>
          </div>
        </div>

        {/* Preset Threshold Badges */}
        <div className="flex flex-wrap gap-2.5 items-center">
          {PRESET_THRESHOLDS.map(preset => {
            const isSelected = selectedThreshold === preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => handleApplyThreshold(preset.value)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none scale-105'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <Icon name={preset.value === 0 ? 'visibility' : 'filter_alt'} className="text-sm" />
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Two Columns: Outlier Sales Table (Manual Selection) & Employee Impact Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Outlier Sales Table with Manual Checkboxes */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col h-full">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Vendas com Muitos Itens Identificadas ({outlierSales.length})
                </h3>
                <p className="text-xs font-bold text-slate-400">
                  Marque ou desmarque individualmente cada cupom para simular o impacto
                </p>
              </div>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg">
                {simulationResults.activeExpurgatedCount} expurgadas
              </span>
            </div>

            {outlierSales.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold">
                Nenhuma venda atípica cadastrada. Clique em "Adicionar Venda Manual" para simular.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[520px] custom-scrollbar pr-2 space-y-2">
                {outlierSales.map(sale => (
                  <div
                    key={sale.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      sale.isExpurgated
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={sale.isExpurgated}
                        onChange={() => handleToggleSingleSale(sale.id)}
                        className="w-5 h-5 rounded-lg text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                        title={sale.isExpurgated ? 'Expurgada do cálculo' : 'Mantida no cálculo'}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md">
                            Dia {sale.day}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase truncate">
                            {sale.employeeName}
                          </span>
                          {sale.isManual && (
                            <span className="text-[8px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                              MANUAL
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {sale.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <span className={`text-sm font-black block ${sale.isExpurgated ? 'text-rose-600 line-through' : 'text-slate-900 dark:text-white'}`}>
                          {sale.itemsCount} itens
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          R$ {sale.totalValue.toLocaleString('pt-BR')}
                        </span>
                      </div>

                      {sale.isManual && (
                        <button
                          onClick={() => handleRemoveSale(sale.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Remover venda manual"
                        >
                          <Icon name="delete" className="text-sm" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Right Col: Per-Employee Impact Table */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col h-full">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  P.A. por Vendedor (Antes vs. Depois)
                </h3>
                <p className="text-xs font-bold text-slate-400">
                  Consistência individual no atendimento 1 a 1
                </p>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[520px] custom-scrollbar space-y-3 pr-1">
              {employeeImpact.map((emp, idx) => (
                <div
                  key={emp.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    emp.isHeavilyInflated
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400">{idx + 1}.</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase">
                        {emp.name}
                      </span>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      emp.isHeavilyInflated
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}>
                      {emp.isHeavilyInflated ? 'Impulsionado por Outliers' : 'Atendimento Orgânico'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">P.A. Bruto</span>
                      <span className="text-sm font-black text-slate-500 line-through">{emp.grossPA}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase block">P.A. Sustentado</span>
                      <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{emp.netPA}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Variação</span>
                      <span className={`text-xs font-black ${parseFloat(emp.delta) < 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                        {emp.delta}
                      </span>
                    </div>
                  </div>

                  {emp.outliersCount > 0 && (
                    <p className="text-[10px] font-bold text-slate-400 mt-2">
                      📦 {emp.outliersCount} vendas volumosas registradas ({emp.expurgatedItems} itens no total)
                    </p>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* ── Add Manual Sale Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 p-6 lg:p-8">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Adicionar Venda Manual (What-If)
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <Icon name="close" className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddManualSale} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Dia do Mês (1 a {daysInMonth})
                </label>
                <input
                  type="number"
                  min={1}
                  max={daysInMonth}
                  value={newSaleDay}
                  onChange={e => setNewSaleDay(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Colaborador / Vendedor
                </label>
                <select
                  value={newSaleEmpId}
                  onChange={e => setNewSaleEmpId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm text-slate-900 dark:text-white"
                  required
                >
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.cargo || 'Atendente'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Qtd. de Itens / Peças
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newSaleItems}
                    onChange={e => setNewSaleItems(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Valor Total (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newSaleValue}
                    onChange={e => setNewSaleValue(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Descrição / Motivo do Cupom
                </label>
                <input
                  type="text"
                  value={newSaleDesc}
                  onChange={e => setNewSaleDesc(e.target.value)}
                  placeholder="Ex: Compra em lote de sacolinhas de festa"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100"
                >
                  Salvar e Simular
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
