# AGENTS.md — Memória de Contexto do Projeto Rhescala

> **Projeto**: Rhescala (Ri Happy Shift Management - Gestão Inteligente de Escalas e Rotinas Operacionais)  
> **Repositório**: `rhescala`  
> **Versão / Stack**: React 19.2, TypeScript 5.8, Vite 6, Tailwind CSS, Google Apps Script (GAS)  
> **Última Atualização**: Setembro de 2026

---

## 📌 1. Visão Geral da Aplicação

O **Rhescala** é uma Single Page Application (SPA) progressiva de alta performance projetada para o varejo da rede **Ri Happy**, automatizando a criação, auditoria, ajuste diário e publicação de escalas de trabalho mensais e rotinas de loja.

O sistema atende integralmente à legislação trabalhista brasileira (CLT, Sazonais e Lei do Jovem Aprendiz), contemplando jornadas 6x1 e 5x2, regras de revezamento de domingos, feriados nacionais/estaduais/municipais com créditos de folga compensatória, posições táticas de loja, rotinas operacionais (limpeza, ronda, seções), auditoria de alterações pós-oficialização e sincronização descentralizada e serverless via Google Sheets (Google Apps Script).

---

## 🛠️ 2. Arquitetura e Stack Tecnológica

### 2.1 Frontend Core
- **Framework**: [React 19](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/package.json#L17) com Hooks modernos (`useMemo`, `useCallback`, `useRef`, `useContext`).
- **Linguagem**: [TypeScript ~5.8](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/package.json#L26) com tipagem estrita centralizada em [types.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts).
- **Bundler & Build**: [Vite 6](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/vite.config.ts) com suporte a singlefile bundle (`vite-plugin-singlefile`) para implantação no Apps Script.
- **Estilização**: Tailwind CSS (suporte completo a Dark Mode via classe `dark`, layouts fluidos e responsivos para Desktop, Tablet e Mobile).
- **Bibliotecas Auxiliares**:
  - `html-to-image` (v1.11): Geração de prints/cards em PNG para compartilhamento instantâneo no WhatsApp.
  - `jspdf` & `jspdf-autotable`: Exportação de relatórios em PDF.
  - `xlsx`: Manipulação de planilhas Excel para importação/exportação.
  - Google Material Icons / Lucide style via componente [Icon.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/Icon.tsx).

### 2.2 Gerenciamento de Estado, Concorrência e Persistência Híbrida
- **Offline-First & Local Storage**:
  - [useLocalStorage](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useLocalStorage.ts): Grava instantaneamente no `window.localStorage` para garantia contra perda de dados.
  - **Multi-Tab Sync**: Utiliza `BroadcastChannel` para sincronizar alterações em tempo real entre diferentes abas abertas no mesmo navegador.
  - **Fila Sequencial Assíncrona Cloud**: Debounce de 2.5 segundos para upload em lote via `syncQueue`, evitando sobrecarga de chamadas ao backend GAS.
  - **Polling Silencioso de Fundo**: Checagem periódica a cada 60 segundos com detecção inteligente de conflitos de versão.
  - **Atalho Global de Salvamento**: `Ctrl+S` / `Cmd+S` para forçar gravação imediata síncrona local e envio para a nuvem.
  - [SyncBlockingOverlay.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/SyncBlockingOverlay.tsx): Feedback visual elegante com backdrop blur durante gravações e sincronizações críticas.

### 2.3 Backend Serverless (Google Apps Script & Google Sheets)
- **Adaptador HTTP**: [gas-api.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src/gas-api.ts) (`apiStore`) realiza requisições `GET`/`POST` parametrizadas contra o Web App do GAS.
- **Código Fonte GAS**: [appsScriptCode.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src/constants/appsScriptCode.ts) implementa um banco de dados NoSQL descentralizado em abas da planilha Google (`ESCALA_DATA`, `AUTH_DATA`, `VACUUM_LOGS`).
- **Pipeline de Build GAS**: Script [gas_fix.cjs](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/gas_fix.cjs) executado no comando `npm run gas-build` para gerar o bundle único compatível com o ecossistema Google Workspace.

---

## 📑 3. Mapa Completo de Arquivos e Componentes

### 3.1 Arquivos Raiz
| Arquivo | Descrição |
| :--- | :--- |
| [App.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/App.tsx) | Componente mestre, orquestrador de rotas/vistas, controle de autenticação (Admin/Viewer), atalhos de teclado e modais globais. |
| [types.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts) | Central de tipos TypeScript (`Employee`, `Holiday`, `ShiftType`, `OfficialScheduleSnapshot`, `ScheduleDiffItem`, `ProtectedDaysConfig`, etc.). |
| [constants.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/constants.tsx) | Definições de posições táticas (`TACTICAL_ROLE_MAP`), horários de turno (`SHIFT_HOURS`), feriados nacionais dinâmicos, desambiguação de nomes (`getShortName`) e mocks. |
| [index.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/index.tsx) | Ponto de entrada React com montagem de DOM e `DialogProvider`. |
| [gas_fix.cjs](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/gas_fix.cjs) | Pós-processador para empacotamento single-file no Google Apps Script. |

### 3.2 Componentes Principais ([components/](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components))

#### Gestão e Edição de Escala
- [ShiftGrid.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ShiftGrid.tsx): Grade mensal interativa em tabela, com células editáveis para turnos, horários diários, posições táticas, indicadores de inconsistências, dias protegidos e atalhos de clique.
- [MobileEmployerViewer.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/MobileEmployerViewer.tsx): Interface mobile e PWA para colaboradores com 5 abas (`hoje`, `semana`, `equipe`, `mes`, `pedidos`), cálculo de pausas de refeição, equipe do turno, envio de solicitações e login individual por senha.
- [TeamView.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/TeamView.tsx): Painel de colaboradores com cadastro, edição rápida, definição de folga fixa, cargos, vigência contratual (admissão/demissão) e preferências.
- [Header.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/Header.tsx): Barra superior com seletores de mês/ano, alternância de visão (Grade, Análise, Equipe, Feriados, Rotinas, Configurações), filtros de turno, status de sincronização, badge de inconsistências e botão de oficialização.
- [ActionToolbar.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ActionToolbar.tsx): Barra de atalhos operacionais rápidos (Aplicar folgas, Distribuir posições, Exportar WhatsApp, Imprimir).

#### Auditoria, Estatísticas e Conformidade
- [AnalysisPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/AnalysisPanel.tsx): Dashboard analítico de cobertura por turno (Abertura, Intermediário, Fechamento), saldo de horas trabalhadas, estatística de domingos e visualização em minicalendários.
- [InconsistencyPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/InconsistencyPanel.tsx) & [InconsistencyModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/InconsistencyModal.tsx): Motor em tempo real de detecção de infrações CLT (violações de 6x1, estouro de domingos seguidos, desfalques de equipe) com resolução automatizada em 1 clique ou correção em massa.
- [ScheduleDiffModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ScheduleDiffModal.tsx): Auditoria pós-oficialização comparando o Snapshot Oficial congelado com a escala em vigor, destacando alterações de turno, horário ou posição tática e permitindo exportar relatório para WhatsApp.

#### Feriados e Saldos Compensatórios
- [HolidayManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/HolidayManager.tsx): Gerenciador de feriados nacionais dinâmicos com algoritmo de Páscoa e cálculo automático de Sexta-feira Santa, além de adição de feriados estaduais/municipais.
- [HolidayCreditPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/HolidayCreditPanel.tsx): Painel de sugestão e compensação de folgas de feriado (`FF`) por colaborador.
- [WorkedHolidaysList.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/WorkedHolidaysList.tsx): Extrato detalhado de todos os feriados trabalhados no ano, status de agendamento/usufruto das folgas e filtro por data de início de rastreamento (`trackingStartDate`).

#### Rotinas Operacionais de Loja
- [CleaningSchedule.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/CleaningSchedule.tsx): Escala mensal balanceada de limpeza da copa (1 responsável por dia) com geração e download de imagem em PNG.
- [PatrolSchedule.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/PatrolSchedule.tsx): Escala mensal de ronda e patrulhamento da loja, dividindo os responsáveis dos turnos de Abertura e Fechamento com exportação em imagem.
- [SectionManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/SectionManager.tsx): Gerenciador de setores de brinquedos por quinzena (Q1 e Q2) com sorteio equilibrado entre turnos.
- [DailyRoutine.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/DailyRoutine.tsx) & [EssentialActivities.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/EssentialActivities.tsx): Checklists e rotinas diárias essenciais de abertura e fechamento de loja.
- [OperationalNotices.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/OperationalNotices.tsx) & [OperationalGuideModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/OperationalGuideModal.tsx): Murais e manuais de avisos operacionais para a equipe.

#### Modais, Comunicação e Impressão
- [ProtectedDaysModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ProtectedDaysModal.tsx): Configuração de dias protegidos do mês com limite customizável de folgas permitidas por dia (`maxFolgas`) e acionamento do algoritmo de otimização de cobertura.
- [PresetOptionsModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/PresetOptionsModal.tsx): Aplicação seletiva de pré-definições (apenas horários, apenas folgas, apenas posições táticas ou completo) por colaborador ou equipe inteira.
- [DaySummaryCard.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/DaySummaryCard.tsx): Resumo detalhado do dia com lista de presentes por turno, horários de almoço calculados, posições táticas, download em PNG e cópia de texto formatado para o WhatsApp.
- [PrintableSchedule.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/PrintableSchedule.tsx): Layout A4 Paisagem (Landscape) para impressão física oficial em papel, contendo tabela com cabeçalho oficial Ri Happy, legendas completas, notas do mês, aniversariantes e afastamentos.
- [EmployeeScheduleCard.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/EmployeeScheduleCard.tsx): Cartão individual completo do colaborador com visualização mensal, diária, saldo de feriados, atestados e formulário de solicitações.
- [RequestManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/RequestManager.tsx): Mural de solicitações dos colaboradores (pedidos de folga, avisos e trocas de turno com aprovação/recusa pelo gestor).
- [DataManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/DataManager.tsx): Gerenciador de dados (Backup/Restore JSON, troca de planilha de loja e limpeza de banco - Vacuum).
- [HelpCenter.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/HelpCenter.tsx): Central de suporte integrada com manuais de regras trabalhistas, atalhos de teclado e guia de uso.
- [Login.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/Login.tsx): Tela de autenticação para perfis `admin` e `viewer`.
- [ErrorBoundary.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ErrorBoundary.tsx): Barreira de contenção contra falhas inesperadas na UI.

### 3.3 Contextos e Hooks ([contexts/](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/contexts) & [hooks/](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks))
- [DialogContext.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/contexts/DialogContext.tsx): Provedor global de diálogos assíncronos (`alert`, `confirm`, `prompt`) com UI moderna integrada ao Tailwind, substituindo `window.alert` e `window.confirm`.
- [useScheduleEngine.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useScheduleEngine.ts): Núcleo da inteligência matemática de escalas, regras CLT, rotação de domingos, distribuição tática e intervalos de refeição.
- [useHolidayCredits.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useHolidayCredits.ts): Cálculo reativo de créditos de feriados trabalhados com conciliação inteligente (casamento explícito e FIFO).
- [useLocalStorage.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useLocalStorage.ts): Hook de persistência reativa com suporte a cache local, BroadcastChannel e sincronização em nuvem.

---

## ⚖️ 4. Regras de Negócio e Engenharia do Motor de Escalas ([useScheduleEngine.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useScheduleEngine.ts))

### 4.1 Rotação de Domingos (CLT 6x1)
1. **Regra de Sequência Máxima**: Nenhum colaborador CLT pode trabalhar 3 domingos consecutivos. O teto inegociável é de **2 domingos consecutivos trabalhados**.
2. **Carryover Inter-meses**: A função `getPrevMonthConsecutive` examina os 2 últimos domingos do mês anterior:
   - Se trabalhou nos 2 últimos domingos do mês N, entra no mês N+1 com streak = 2 e tem prioridade absoluta de folga no 1º domingo.
   - Se trabalhou no último domingo, entra com streak = 1.
3. **Mínimo de Equipe nos Domingos**: `minSundayWorkers` (padrão: 5 colaboradores CLT presentes).
4. **Indisponibilidade Automática**: Férias (`FE`), atestado (`AT`), aniversário (`DO`), folga preferencial no Domingo, contrato não vigente (`hiredAt`/`firedAt`) ou curso (`C`) retiram o colaborador da escala de domingo sem contar como falta ou violação.

### 4.2 Jovem Aprendiz
- **Jornada Fixa**: `10h às 16h15` com 15 minutos de intervalo de refeição.
- **Descanso Obrigatório**: Proibido trabalhar em fins de semana (Sábado e Domingo) e feriados.
- **Curso Teórico**: Turno `C` obrigatório no dia da semana configurado (`courseDay`).
- **Posição Tática**: Prioridade para alocação na Recepção/Porta (`P2`). Não gera créditos de feriado.

### 4.3 Posições Táticas e Classificação de Turnos
- **Cargos**: `Atendente`, `Estoquista`, `Aprendiz`, `Fiscal`.
- **Posições Táticas no Grid**:
  - `P1` (Caixa - 🟥)
  - `PC` (Pacote - 🟧)
  - `P2` (Recepção / Porta - 🟨 - Prioridade Fiscal e Aprendiz)
  - `P3` (Salão de Vendas - 🟩 - Padrão de Atendimento)
  - `P4` (Apoio Flexível - 🟦)
  - `ESTQ` (Estoque - 📦 - Fixo para Estoquistas)
- **Tipos de Turno na Grade**:
  - `T`: Trabalho regular.
  - `F`: Folga semanal.
  - `FF`: Folga compensatória de feriado trabalhado (ex: `FF 2026-09-07`).
  - `FE`: Férias regulamentares.
  - `DO`: Day Off (Folga de Aniversário).
  - `AT`: Atestado médico / Afastamento.
  - `C`: Curso teórico do Jovem Aprendiz.
  - `N/A`: Contrato não vigente no dia.
- **Modos de Exibição Tática**: `positions` (P1, P2, P3...), `roles` (CX, FISC, ATEND...) ou `off` (T).

### 4.4 Intervalos de Refeição Escalonados (`calculateLunches`)
- O motor calcula horários de almoço individualizados para os colaboradores presentes no dia:
  - **Dias de Semana - Abertura**: Rotação entre `13h`, `13h45` e `14h`.
  - **Dias de Semana - Fechamento**: Rotação entre `15h`, `15h30`, `16h`, `16h30` e `17h`.
  - **Domingos**: Abertura às `13h` e Fechamento entre `14h` e `17h`.
  - **Jovem Aprendiz**: Fixo às `12h45` (15 min).
  - **Feriados**: Intervalo padrão de `15 min`.

### 4.5 Ciclo de Vida da Escala: Rascunho vs. Oficial (Snapshots & Diffs)
1. **Modo Rascunho**: O gestor (`admin`) planeja e edita a escala livremente. No modo `viewer` (equipe), a escala aparece como "Escala em Construção".
2. **Oficialização**: Ao validar, o sistema gera um [OfficialScheduleSnapshot](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts#L115) congelado contendo o estado exato de turnos, horários e posições. A escala é imediatamente disponibilizada para a equipe.
3. **Auditoria de Alterações (`ScheduleDiffModal`)**: Qualquer mudança efetuada após a oficialização é registrada como divergência (`ScheduleDiffItem`), identificando quem alterou, data, valor original e valor atualizado.

### 4.6 Otimização de Semanas de Pico Sazonal e Dias Protegidos (Motor Peak-Centric & Cenário Ideal)
- **Engenharia de Cenário Ideal Operacional**: O motor otimiza a escala visando a máxima eficiência da loja independente de preferências fixas que criem gargalos, operando com base nas seguintes proporções e regras estritas:
  1. **Sábados e Dias de Pico (100% de Presença)**: 100% dos colaboradores regulares trabalham nos sábados e blocos de evento (Dia das Crianças 10 a 12/10, Natal 20 a 24/12, Black Friday), sem folgas de rotina.
  2. **Sextas-feiras (Alta Demanda)**: Máxima presença (~85% a 100%), limitando folgas ao estritamente necessário para cumprimento de 5x2.
  3. **Dias Úteis (Segunda a Quinta - ~25% de Folga Simétrica)**: A equipe é dividida em **4 grupos de revezamento equilibrados** ($g = \text{empIdx} \pmod 4$), garantindo que cada dia útil tenha aproximadamente $\approx \lceil N/4 \rceil$ folgas e mantenha entre 70% e 80% de presença estável na loja.
  4. **Domingos**: Rotação CLT com teto inegociável de 2 domingos consecutivos trabalhados e garantia do efetivo mínimo `minSundayWorkers` (~35% a 40% de presença). Domingos protegidos com `maxFolgas: 0` têm 100% de trabalho.
  5. **Escalonamento Pré e Pós-Pico (Lookback & Lookahead)**: Nos blocos de pico, o algoritmo divide a equipe em grupos de ~25% e escalona folgas em $D_{start}-4, D_{start}-3, D_{start}-2, D_{start}-1$ e folgas pós-pico em $D_{end}+1, D_{end}+2$, conectando com o início e fim do mês com **0 violações de CLT 6x1 e 5x2**.
- **Preservação Rígida de Restrições Legais e Individuais**:
  - Férias (`FE`), atestado (`AT`), aniversário (`DO`) e vigência contratual (`N/A`) são 100% intocáveis.
  - Jovem Aprendiz: descanso obrigatório aos sábados, domingos e feriados, e curso teórico (`C`) no dia fixo (`courseDay`).
- **Bloqueio de Colaboradores Específicos**: Possibilidade de selecionar colaboradores obrigatórios no [ProtectedDaysModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ProtectedDaysModal.tsx).
- **Presets Sazonais em 1 Clique**: Dia das Crianças (8 a 12/10), Black Friday (26 a 29/11), Natal (20 a 24/12) e Início do Mês.

### 4.7 Regra do 1º de Maio e Créditos de Feriado
- **1º de Maio (Dia do Trabalho)**: O trabalho nesta data concede **2 créditos de folga compensatória** (Folga 1 e Folga 2).
- **Conciliação Inteligente**: O hook `useHolidayCredits` casa os feriados trabalhados em meses oficializados com as folgas `FF` concedidas no ano, classificando o status em `granted` (usufruído), `scheduled` (agendado no futuro) ou `pending` (pendente).

---

## 🔒 5. Autenticação e Perfis de Acesso

1. **Perfil Administrador (`admin`)**:
   - Acesso irrestrito a edição de turnos, horários, posições táticas, geração de novos meses, aplicação de presets, oficialização, gestão de feriados, parâmetros de jornada, backup e limpeza de banco.
   - Protegido por senha mestra criptografada/validada no GAS ou localmente.
2. **Perfil Visualizador / Colaborador (`viewer`)**:
   - Modo somente leitura da escala oficializada da equipe.
   - Interface adaptada para smartphones ([MobileEmployerViewer.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/MobileEmployerViewer.tsx)).
   - **Acesso Individual com Senha do Colaborador**: Cada colaborador pode possuir uma senha individual (`password`) para acessar seu cartão individual, visualizar seu histórico de feriados e enviar pedidos de folga ou trocas de turno.

---

## 🚀 6. Boas Práticas e Diretrizes para Desenvolvimento

1. **Tipagem e TypeScript**:
   - Centralizar todas as novas interfaces em [types.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts).
   - Não utilizar `any` indiscriminadamente. Respeitar uniões estritas de `ShiftType`, `EmployeeCargo` e `TacticalDisplayMode`.
2. **Desempenho e Re-renderizações**:
   - As funções pesadas do motor de escalas em [useScheduleEngine.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useScheduleEngine.ts) devem ser puras e isoladas.
   - Utilizar `useMemo` em transformações de matrizes mensais para manter a navegação entre meses instantânea.
3. **Persistência Segura**:
   - Qualquer mutação de colaboradores ou parâmetros deve ocorrer via `setEmployees` / `setJornadaSettings` vinculados ao `useLocalStorage` para garantir sincronismo no cache local e nuvem.
4. **Design e Usabilidade**:
   - Manter consistência visual com Tailwind CSS, preservando Dark Mode, contraste acessível, micro-animações e suporte a telas pequenas (Mobile First no modo colaborador).
   - Diálogos interativos e confirmações devem utilizar exclusivamente o hook `useDialog()` do [DialogContext.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/contexts/DialogContext.tsx).

---
