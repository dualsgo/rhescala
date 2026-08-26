# AGENTS.md — Memória de Contexto do Projeto Rhescala

> **Projeto**: Rhescala (Ri Happy Shift Management - Gestão de Escala Diária e Mensal)  
> **Repositório**: `rhescala`  
> **Última Atualização**: Agosto de 2026

---

## 📌 Visão Geral da Aplicação

O **Rhescala** é um sistema web inteligente e responsivo desenvolvido em React, TypeScript e Vite para automatizar e gerenciar escalas de trabalho em lojas de varejo da rede **Ri Happy**. O sistema suporta regras trabalhistas brasileiras (CLT e Jovem Aprendiz), considerando jornadas 6x1 e 5x2, escalas de domingos, feriados, folgas, trocas de turno, alocação de posições táticas e integração com backend Serverless em Google Apps Script (GAS) via Google Sheets.

---

## 🛠️ Arquitetura e Stack Tecnológica

- **Frontend Core**: React 19, TypeScript (~5.8), Vite (v6), Tailwind CSS (estilização moderna e responsiva), `html-to-image` (geração de cartões/imagens), Lucide Icons.
- **Gerenciamento de Estado e Persistência**:
  - `useLocalStorage` (`hooks/useLocalStorage.ts`): Armazenamento local reativo com debouncing e integração assíncrona com nuvem.
  - `apiStore` (`src/gas-api.ts`): Cliente HTTP para comunicação com o backend em Google Apps Script (GAS).
- **Backend / Banco de Dados**:
  - Google Apps Script Web App atuando como banco de dados NoSQL descentralizado em Planilha Google.
  - O código-fonte da API GAS está contido em `src/constants/appsScriptCode.ts`.
  - Pós-processador de build single-file: `gas_fix.cjs` (comando `npm run gas-build`).
  - Servidor Node.js opcional (`server/index.js`).

---

## 📑 Estrutura de Diretórios e Arquivos Principais

- [App.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/App.tsx) — Componente raiz, controle de abas, modos (Admin/Viewer), autenticação e estado global
- [types.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts) — Interfaces TypeScript (`Employee`, `Holiday`, `EmployeeRequest`, `JornadaSettings`, etc.)
- [constants.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/constants.tsx) — Constantes de turnos, jornadas padrão, feriados nacionais e gerador de MOCKs
- [vite.config.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/vite.config.ts) — Configurações do Vite (porta, plugins React e singlefile)
- [package.json](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/package.json) — Dependências e scripts npm (`dev`, `build`, `gas-build`)

### Componentes ([components/](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components))
- [ShiftGrid.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ShiftGrid.tsx) — Grade principal da escala (edição mensal interativa)
- [TeamView.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/TeamView.tsx) — Visão simplificada e mobile-friendly para colaboradores (modo Viewer)
- [AnalysisPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/AnalysisPanel.tsx) — Painel estatístico e análise de cobertura/horas/domingos
- [InconsistencyPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/InconsistencyPanel.tsx) — Motor de auditoria de regras trabalhistas em tempo real
- [InconsistencyModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/InconsistencyModal.tsx) — Modal interativo para notificação e resolução de inconsistências
- [HolidayManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/HolidayManager.tsx) — Gerenciador de feriados (nacionais dinâmicos + estaduais/municipais)
- [HolidayCreditPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/HolidayCreditPanel.tsx) — Painel de saldo de folgas/créditos de feriados trabalhados
- [RequestManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/RequestManager.tsx) — Mural de solicitações dos colaboradores (folgas, trocas de turno)
- [EmployeeScheduleCard.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/EmployeeScheduleCard.tsx) — Cartão individual impresso/compartilhável do colaborador
- [JornadaManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/JornadaManager.tsx) — Configuração de parâmetros de jornada, horários e refeição
- [DataManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/DataManager.tsx) — Backup JSON, limpeza de banco (Vacuum) e troca de loja
- [Header.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/Header.tsx) — Barra superior com navegação, busca, filtros e login
- [ActionToolbar.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ActionToolbar.tsx) — Barra de atalhos e ações da escala
- [SyncBlockingOverlay.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/SyncBlockingOverlay.tsx) — Modal bloqueante de alerta com efeito blur durante sincronização/gravação na nuvem

### Hooks ([hooks/](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks))
- [useScheduleEngine.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useScheduleEngine.ts) — Motor de geração de escala, controle de domingos seguidos e refeição
- [useLocalStorage.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useLocalStorage.ts) — Hook de sincronização de dados (localStorage + GAS)
- [useHolidayCredits.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useHolidayCredits.ts) — Cálculo automático de créditos de feriado por colaborador

### Serviços & Backend ([src/](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src))
- [gas-api.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src/gas-api.ts) — Adaptador de API HTTP para Google Apps Script
- [appsScriptCode.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src/constants/appsScriptCode.ts) — Código fonte do Apps Script para implantação no Google Sheets

---

## ⚖️ Regras de Negócio e Lógica de Escala ([useScheduleEngine.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useScheduleEngine.ts))

1. **Gestão de Domingos (CLT)**:
   - **Regra de Sequência**: Máximo de 2 domingos consecutivos trabalhados. Se trabalhou nos 2 últimos domingos do mês anterior (carryover via `getPrevMonthWorkStreak`), tem prioridade para folgar no 1º domingo do novo mês.
   - **Mínimo de Equipe**: `minSundayWorkers` (padrão: 5 colaboradores CLT no domingo).
   - **Indisponibilidade Automática**: Férias (`FE`), atestado (`AT`), aniversário (`DO`), dia preferencial de folga ser Domingo, contrato não vigente ou curso.
2. **Jovem Aprendiz**:
   - Jornada fixa (`10h às 16h15` com pausa de 15 min de refeição).
   - Proibido trabalhar em fins de semana (sábado/domingo) e feriados.
   - Folga obrigatória no dia do curso teórico (`courseDay`).
3. **Cargos e Posições Táticas**:
   - Cargos: `Atendente`, `Estoquista`, `Aprendiz`, `Fiscal`.
   - Posições Táticas no Grid: `P1`, `P2`, `P3`, `P4`, `ESTQ` (Estoque).
   - Tipos de Turno: `T` (Trabalho), `F` (Folga), `FF` (Folga Feriado), `FE` (Férias), `C` (Curso), `DO` (Birthday Day Off), `AT` (Atestado), `N/A`.
4. **Fluxo Rascunho vs. Oficial**:
   - **Rascunho**: Escala em preparação pelo gerente (`admin`). Visível apenas no perfil Admin.
   - **Oficial (Oficializada)**: Validada pelo gerente. Apenas escalas oficializadas aparecem no modo `viewer` (equipe).
5. **Autenticação e Perfis**:
   - Perfis de acesso: `admin` (acesso total a edição e configurações) e `viewer` (visualização da equipe).
   - Login individual de colaboradores por senha própria para visualização do cartão pessoal.
6. **Otimização de Semanas de Pico Sazonal**:
   - **Outubro (Dia das Crianças - 8 a 12/10)**: 100% da equipe CLT e Sazonal trabalha nos 5 dias de pico crítico (8, 9, 10, 11 e 12). As folgas semanais são escalonadas cirurgicamente nos dias pré-pico (6 e 7) e pós-pico (13 e 14) sem violar a regra 6x1 (máximo 6 dias consecutivos trabalhados) e sem gerar conflitos de domingos ou 5x2. Aprendizes mantêm folga no feriado (12/10) e fins de semana.
   - **Dezembro (Natal - 18 a 24/12)**: 100% da equipe presente nos dias 22, 23 e 24, com folgas distribuídas entre 18 e 21 de Dezembro.

---

## 🚀 Boas Práticas e Diretrizes de Desenvolvimento

1. **TypeScript e Tipagem**:
   - Manter os tipos centralizados em [types.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts).
   - Evitar `any`. Respeitar os enums e uniões de tipo de `ShiftType`, `EmployeeCargo` e `JornadaSettings`.
2. **Estilização**:
   - Utilizar **Tailwind CSS** para classes utilitárias e componentes visuais modernos.
   - Preservar o suporte a Modo Escuro (`isDarkMode`) e responsividade mobile.
3. **Persistência**:
   - Qualquer alteração nos dados do colaborador ou configurações deve passar pelo hook `useLocalStorage` para garantir que o estado local e o sync com o GAS continuem alinhados.
4. **Desempenho**:
   - Operações pesadas no motor de escala (`useScheduleEngine.ts`) utilizam memoização (`useMemo`/`useCallback`) para garantir navegação rápida entre meses.

---
