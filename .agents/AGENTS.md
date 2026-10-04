# AGENTS.md — Memória de Contexto do Projeto Rhescala

> **Projeto**: Rhescala (Ri Happy Shift Management - Gestão Inteligente de Escalas e Rotinas Operacionais)  
> **Repositório**: `rhescala`  
> **Versão / Stack**: React 19.2, TypeScript 5.8, Vite 6, Tailwind CSS, Google Apps Script (GAS) & Node.js Express Server  
> **Última Atualização**: Outubro de 2026

---

## 📌 1. Visão Geral da Aplicação

O **Rhescala** é uma Progressive Web Application (PWA) de alta performance projetada especificamente para o varejo da rede **Ri Happy**, automatizando a criação, auditoria, ajuste diário e publicação de escalas de trabalho mensais e rotinas operacionais de loja.

O sistema atende integralmente à legislação trabalhista brasileira (CLT, Sazonais e Lei do Jovem Aprendiz), contemplando jornadas 6x1 e 5x2, regras de revezamento de domingos (máximo de 2 domingos consecutivos trabalhados com carryover entre meses), feriados nacionais/estaduais/municipais com créditos de folga compensatória (`FF`), distribuição equilibrada de **Funções (correlatas)** de loja (Caixa, Pacote, Reposição/Organização, Vendas/Atendimento, Fiscal e Estoque), rotinas operacionais (limpeza da copa, rondas/patrulhamento, gestão de setores de brinquedos), auditoria de divergências pós-oficialização (`ScheduleDiffItem`), blindagem estrita de privacidade para colaboradores e persistência híbrida e resiliente via Google Sheets (Google Apps Script) e API Express/MongoDB alternativa.

---

## 🛠️ 2. Arquitetura e Stack Tecnológica

### 2.1 Frontend Core
- **Framework**: [React 19](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/package.json#L17) com Hooks modernos (`useMemo`, `useCallback`, `useRef`, `useContext`, `useEffect`).
- **Linguagem**: [TypeScript ~5.8](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/package.json#L26) com verificação estrita de tipos centralizada em [types.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts).
- **Bundler & Build**: [Vite 6](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/vite.config.ts) com suporte a singlefile bundle (`vite-plugin-singlefile`) para empacotamento completo em HTML único quando implantado no Google Apps Script.
- **Estilização**: Tailwind CSS com suporte integral a Dark Mode (classe `dark` na raiz), layouts responsivos para Desktop, Tablet e modo Mobile First para colaboradores.
- **Bibliotecas Auxiliares**:
  - `html-to-image` (v1.11): Geração de cards em alta definição (PNG) para compartilhamento instantâneo no WhatsApp.
  - `jspdf` & `jspdf-autotable`: Exportação de relatórios em formato PDF oficial.
  - `xlsx`: Processamento de planilhas Excel.
  - Google Material Symbols / Lucide style via componente universal [Icon.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/Icon.tsx).

### 2.2 Gerenciamento de Estado, Concorrência e Persistência Híbrida
- **Offline-First & Local Storage**:
  - [useLocalStorage.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useLocalStorage.ts): Gravação local reativa com proteção instantânea contra perda de dados.
  - **Multi-Tab Sync**: Sincronização em tempo real entre abas no mesmo navegador usando `BroadcastChannel` (`sync_riHappyEmployeesData`, `sync_riHappyValidatedMonths`).
  - **Fila Assíncrona Cloud**: Debounce de 2.5s para upload em lote via `syncQueue`, evitando throttling e estouro de cota da API.
  - **Polling Silencioso de Fundo**: Verificação de novas atualizações a cada 60 segundos com resolução de concorrência.
  - **Atalho Global de Salvamento**: `Ctrl+S` / `Cmd+S` para forçar gravação síncrona imediata no cache e envio para nuvem.
  - [SyncBlockingOverlay.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/SyncBlockingOverlay.tsx): Feedback visual com backdrop blur durante gravações e sincronizações críticas.

### 2.3 Backends e Conectividade
1. **Google Apps Script & Google Sheets (Padrão Serverless)**:
   - [gas-api.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src/gas-api.ts) (`apiStore`): Adaptador HTTP para `GET`/`POST` parametrizados contra a URL do Web App configurada na tela de setup.
   - [appsScriptCode.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src/constants/appsScriptCode.ts): Código fonte GAS completo que implementa um banco NoSQL em abas da planilha Google (`ESCALA_DATA`, `AUTH_DATA`, `VACUUM_LOGS`) com hash de senhas, validação de setup e rotina de limpeza (`vacuum`).
   - [gas_fix.cjs](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/gas_fix.cjs): Script pós-processador executado em `npm run gas-build`.
2. **Servidor Node.js / Express + MongoDB Atlas (Opcional em [server/](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/server))**:
   - Backend leve em Express com suporte a MongoDB Atlas (Mongoose) ou cache in-memory fallback, pronto para deploy em serviços como Render ou Railway.

---

## 📑 3. Mapa Completo de Arquivos e Componentes

### 3.1 Arquivos Raiz e Utilitários
| Arquivo | Descrição |
| :--- | :--- |
| [App.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/App.tsx) | Componente mestre da aplicação, orquestrador de rotas/vistas, controle de autenticação (Admin/Viewer), atalhos de teclado e modais globais. |
| [types.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts) | Central de tipos TypeScript (`Employee`, `ShiftType`, `Holiday`, `OfficialScheduleSnapshot`, `ScheduleDiffItem`, `ProtectedDaysConfig`, `JornadaSettings`, etc.). |
| [constants.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/constants.tsx) | Constantes globais, mapeamento de Funções correlatas (`TACTICAL_ROLE_MAP`), horários oficiais de turnos (`SHIFT_HOURS`), desambiguação de nomes curtos (`getShortName`) e feriados nacionais dinâmicos. |
| [index.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/index.tsx) | Ponto de entrada React com montagem no DOM e envelopamento pelo `DialogProvider`. |
| [gas_fix.cjs](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/gas_fix.cjs) | Processador de bundling para o Google Apps Script. |
| [src/gas-api.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src/gas-api.ts) | Camada de conexão com a API Web App (login, checkSetup, get, set, updatePassword, vacuum). |
| [src/utils/clipboard.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/src/utils/clipboard.ts) | Utilitário seguro para cópia para área de transferência com fallback. |
| [server/index.js](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/server/index.js) | Servidor Express alternativo com endpoints chave-valor e integração com MongoDB Atlas. |

### 3.2 Componentes Principais ([components/](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components))

#### Gestão e Edição de Escala
- [ShiftGrid.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ShiftGrid.tsx): Grade mensal interativa em tabela:
  - Células editáveis de turno, horário diário individual e Função (correlata).
  - **Indicadores Bilaterais de Ciclo e Sequência na Célula**:
    - **Canto Superior Esquerdo (Ciclo 6x1)**: Sequência de trabalho progressiva `1/6` a `6/6` em dias trabalhados normais; **Badge `7º`** em vermelho pulsante quando há infração CLT (trabalho sem DSR).
    - **Canto Superior Direito (Domingos e Folgas)**: Sequência de domingos trabalhados (`1D`, `2D`, `3D`) ou folgas dominicais cumpridas (`1D✓`, `2D✓`, `3D✓`), facilitando leitura imediata e identificação de oportunidades de troca.
    - **Controle de Densidade**: Alternador `cycleBadgesMode` (`all` = todos visíveis, `alerts` = apenas alertas de violação, `off` = ocultos).
  - Ponto indicador âmbar no canto inferior esquerdo para alterações pós-oficialização (`diff`).
  - Agrupamento de colaboradores por turno (Abertura, Intermediário, Fechamento, Folgas/Outros).
  - Filtro por tipo de contrato (Todos, CLT, Sazonal), filtro de presença diária ("Apenas presentes hoje"), modo compacto de grade e foco suave (blur) nas colunas fora do dia selecionado.
  - Auto-scroll suave até o dia de hoje no mês corrente.
  - **Desacoplamento de Linha**: Clicar na linha do colaborador apenas realça visualmente a linha para facilitar a leitura; não realiza login automático nem abre dados confidenciais.
- [Header.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/Header.tsx):
  - **Modo Gestor (Admin)**: Navegação de mês/ano, alternância de views (Grade, Análise, Equipe, Feriados, Setores, Limpeza, Rondas, Jornada, Pedidos), status de sincronização em nuvem, contador de inconsistências, botão de oficialização e ferramentas avançadas.
  - **Modo Colaborador / Visualizador (Viewer)**: Interface limpa e minimalista contendo estritamente a marca (`Rhescala • Colaborador`), seletor de mês, indicador `Oficial`, atalho `Acesso Gerencial` e `Sair`. Menus administrativos, gavetas e ferramentas de edição ficam 100% ocultos.
- [ActionToolbar.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ActionToolbar.tsx): Barra de atalhos operacionais rápidos (Aplicar folgas, Distribuir funções correlatas, Exportar WhatsApp, Imprimir).
- [MobileNavBar.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/MobileNavBar.tsx): Barra de navegação inferior móvel simplificada para o colaborador, exibindo apenas as abas essenciais ("Escala" e "Hoje"), ocultando gavetas e itens de gestão.
- [MobileEmployerViewer.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/MobileEmployerViewer.tsx): Interface PWA dedicada para smartphones dos colaboradores, com abas (`hoje`, `semana`, `equipe`, `mes`, `pedidos`), cálculo de intervalo de refeição, equipe do turno, envio de solicitações e login individual por senha.
- [TeamView.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/TeamView.tsx): Gestão de colaboradores com cadastro completo, edição rápida, folga fixa, cargos, vigência de contrato (`hiredAt`/`firedAt`), cálculo de término de férias (+29 dias) com marcação de `FE` e atestados médicos (`AT`) por período em dias.

#### Auditoria, Conformidade e Otimização
- [AnalysisPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/AnalysisPanel.tsx): Dashboard analítico de cobertura por turno (Abertura, Intermediário, Fechamento), saldo de horas trabalhadas, estatística de domingos e visualização em minicalendários.
- [InconsistencyPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/InconsistencyPanel.tsx) & [InconsistencyModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/InconsistencyModal.tsx): Motor em tempo real de detecção de infrações CLT (violações de 6x1, estouro de domingos seguidos, desfalques de equipe) com resolução automatizada em 1 clique ou correção em massa.
- [ScheduleDiffModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ScheduleDiffModal.tsx): Auditoria pós-oficialização comparando o Snapshot Oficial congelado com a escala em vigor, destacando alterações de turno, horário ou Função correlata e permitindo exportar relatório para WhatsApp.
- [ProtectedDaysModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ProtectedDaysModal.tsx): Configuração de dias protegidos do mês com limite customizável de folgas permitidas por dia (`maxFolgas`) e acionamento do algoritmo de otimização de cobertura.
- [CreateMonthModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/CreateMonthModal.tsx): Criação de novo mês com escolha entre Escala Sugerida Inteligente (com verificação retroativa estrita CLT) ou Escala Base 100% Trabalhada.
- [PresetOptionsModal.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/PresetOptionsModal.tsx): Aplicação seletiva de pré-definições (apenas horários, apenas folgas, apenas funções correlatas ou completo) por colaborador ou equipe inteira.

#### Configurações, Parâmetros e Conexão
- [JornadaManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/JornadaManager.tsx): Configurações avançadas de jornada e operação de loja:
  - Operação mínima nos domingos (`minSundayWorkers`).
  - Faixas de horários padrão para Dias de Semana, Domingos, Feriados, Jovem Aprendiz e Horários Estendidos/Sazonais.
  - Regras e slots de almoço para Abertura e Fechamento em dias úteis e domingos.
- [SetupScreen.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/SetupScreen.tsx): Tela de integração e setup de nova unidade de loja:
  - Exibição e cópia em 1 clique do código backend Apps Script.
  - Validação da URL do Web App do GAS.
  - Definição das senhas mestras de Gerente (`admin`) e Equipe (`viewer`).
- [DataManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/DataManager.tsx):
  - Exportação e importação de Backup completo em JSON v2.1.
  - **Exportação da Escala de Vendas em JSON** (`escala_vendas_YYYY-MM-DD.json`) contendo array de `{ colaborador, data, posicao }` para integrações com sistemas de metas/vendas.
  - Execução de limpeza de banco (Vacuum na planilha Google).
  - Alteração remota de senhas Admin e Viewer.
  - Desconexão de loja para troca de planilha.
- [Login.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/Login.tsx): Tela de autenticação com suporte aos perfis `admin` e `viewer`.

#### Feriados e Rotinas Operacionais de Loja
- [HolidayManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/HolidayManager.tsx): Gerenciador de feriados nacionais dinâmicos (com algoritmo de Páscoa/Carnaval/Corpus Christi/Sexta-feira Santa) e feriados estaduais/municipais.
- [HolidayCreditPanel.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/HolidayCreditPanel.tsx) & [WorkedHolidaysList.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/WorkedHolidaysList.tsx): Controle reativo de créditos de folgas compensatórias (`FF`) por feriado trabalhado.
- [CleaningSchedule.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/CleaningSchedule.tsx): Escala equilibrada de limpeza da copa (1 responsável por dia) com exportação em imagem PNG.
- [PatrolSchedule.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/PatrolSchedule.tsx): Escala mensal de ronda e patrulhamento da loja por turno (Abertura e Fechamento) com exportação em imagem PNG.
- [SectionManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/SectionManager.tsx): Gerenciador de setores de brinquedos por quinzena (Q1 e Q2) com distribuição balanceada entre turnos.
- [DailyRoutine.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/DailyRoutine.tsx) & [EssentialActivities.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/EssentialActivities.tsx): Checklists e procedimentos diários de abertura e fechamento.
- [DaySummaryCard.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/DaySummaryCard.tsx): Resumo detalhado do dia com presentes por turno, almoços calculados, funções correlatas, cópia para WhatsApp e download em imagem.
- [PrintableSchedule.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/PrintableSchedule.tsx): Layout oficial A4 Paisagem (Landscape) para impressão física de escala com notas, aniversariantes e afastamentos.
- [EmployeeScheduleCard.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/EmployeeScheduleCard.tsx): Cartão individual do colaborador com escala do mês, turno atual, solicitações de folga/troca e atestados. Possui botão **"Bloquear Sessão"** para encerramento imediato da privacidade.
- [RequestManager.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/RequestManager.tsx): Mural de pedidos de folga, avisos e trocas de turno enviados pelos colaboradores para aprovação pelo gestor.
- [HelpCenter.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/HelpCenter.tsx): Central de suporte com manuais de regras trabalhistas, atalhos e boas práticas.
- [ErrorBoundary.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/ErrorBoundary.tsx): Barreira de contenção contra falhas inesperadas na UI.

---

## ⚖️ 4. Funções e Engenharia do Motor de Escalas ([useScheduleEngine.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useScheduleEngine.ts))

O arquivo [useScheduleEngine.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useScheduleEngine.ts) contém a inteligência central do Rhescala. Principais funções exportadas:

| Função | Finalidade |
| :--- | :--- |
| `generateMonthForEmployee` | Gera a escala mensal completa para um colaborador específico com rotação contínua de 6x1 ou 5x2, integrando carryover do mês anterior, preferências e folgas de domingo. |
| `generateYearSchedule` | Gera a escala para todo o ano para a equipe de colaboradores. |
| `generateCleanMonthSchedule` | Gera o modo base 100% trabalhado (`T`) preservando afastamentos, aniversários e regras de aprendiz para edição manual. |
| `buildSundayAssignments` | Algoritmo de revezamento de domingos respeitando o teto inegociável de 2 domingos consecutivos e garantia do mínimo operacional `minSundayWorkers`. |
| `getPrevMonthConsecutive` | Examina os 2 últimos domingos do mês anterior para calcular o streak com o qual o colaborador entra no novo mês. |
| `getPrevMonthWorkStreak` | Calcula os dias consecutivos de trabalho sem descanso vindos do final do mês anterior. |
| `findSundayViolations` | Varre a escala e identifica colaboradores com 3 ou mais domingos consecutivos trabalhados. |
| `optimizeProtectedDays` | Motor peak-centric que redistribui folgas em dias protegidos/de alta demanda mantendo conformidade estrita com a CLT. |
| `optimizePeakWeek` | Otimiza blocos sazonais genéricos de alta demanda. |
| `optimizeOctoberPeak` | Preset otimizado para o Dia das Crianças (8 a 12 de outubro). |
| `optimizeDecemberPeak` | Preset otimizado para o Natal e fim de ano (20 a 24 de dezembro). |
| `distributeTacticalPositions` | Distribui automaticamente as Funções correlatas (`P1`/Caixa/Pacote, `P2`/Reposição, `P3`/Vendas, `P4`/Fiscal, `ESTQ`/Estoque) com base no cargo, preferências e equilíbrio de turnos. |
| `resolveTacticalDay` | Resolve as Funções correlatas da equipe para um dia específico. |
| `getShiftClassification` | Classifica o horário em `Abertura`, `Intermediário`, `Fechamento` ou `N/A`. |
| `calculateLunches` | Calcula os horários de almoço individualizados e escalonados para todos os colaboradores presentes no dia. |
| `getCleaningSchedule` | Gera a rotação mensal de limpeza da copa (1 colaborador por dia). |
| `applyHoursOnly` | Aplica apenas os horários padrão oficiais sem alterar as folgas existentes. |
| `applyFolgasOnly` | Aplica apenas a lógica de folgas e domingos preservando os horários já definidos. |
| `applyTacticalOnly` | Aplica apenas a redistribuição de Funções correlatas. |
| `applyMonthUpdate` | Aplica um mês completo de turnos gerados a um colaborador. |
| `detectScheduleDiffs` | Compara o snapshot oficial congelado com a escala atual e lista todas as divergências (`ScheduleDiffItem`). |
| `isWorkingShift` | Determina se um código de turno representa um dia trabalhado (`T`, códigos de funções). |

---

## 🏷️ 5. Convenção de Funções (correlatas) de Loja

Para modernização da nomenclatura e conformidade operacional com as lojas, as posições foram migradas de "posições táticas" para **Funções (correlatas)**, preservando os códigos internos legados para compatibilidade com dados salvos e relatórios de vendas:

| Código Interno | Aliases de Exibição | Função (correlata) | Descrição Operacional |
| :--- | :--- | :--- | :--- |
| `P1` | `CX` | **Caixa** | Operação de frente de caixa e checkout prioritário. |
| `PC` / `P1` | `PC` | **Pacote** | Apoio de empacotamento e suporte imediato ao caixa. |
| `P2` | `REP` | **Reposição/Organização** | Reposição contínua, precificação, organização de gôndolas e salão. |
| `P3` | `VEND` | **Vendas/Atendimento** | Atendimento consultivo ao cliente, demonstração de brinquedos e abordagem de pista. |
| `P4` | `FISC` | **Fiscal/Prevenção** | Fiscalização de loja, prevenção de perdas, monitoramento de entrada e saída. |
| `ESTQ` | `ESTQ` | **Estoque** | Recebimento de mercadorias, conferência, triagem e abastecimento de retaguarda. |

---

## 🔒 6. Autenticação, Perfis de Acesso e Privacidade

1. **Perfil Administrador / Gestor (`admin`)**:
   - Acesso irrestrito a edição de turnos, horários, Funções correlatas, geração de novos meses, aplicação de presets, oficialização, gestão de feriados, parâmetros de jornada, backup e limpeza de banco.
   - Protegido por senha mestra de loja validada contra a planilha Google ou localmente.
2. **Perfil Visualizador / Colaborador (`viewer`)**:
   - **Foco e Simplicidade**: Interface minimalista com navegação travada na grade e dia de hoje, sem menus secundários, gavetas ou opções administrativas dispensáveis.
   - **Leitura Coletiva Sem Invasão de Privacidade**: Visualiza a grade oficial com turnos e funções da equipe. Clicar em uma linha da tabela apenas realça visualmente a linha para guiar a leitura, sem autenticar o usuário.
   - **Blindagem Estrita de Acesso Individual (Senha Obrigatória)**:
     - Qualquer tentativa de abrir o cartão individual ([EmployeeScheduleCard.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/components/EmployeeScheduleCard.tsx)) — seja clicando no nome do colaborador na grade ou selecionando "Meu Nome" no cabeçalho — exige obrigatoriamente a senha individual do colaborador (`emp.password || '1234'`).
     - Não há bypass de visualização de dados de terceiros.
     - Botão explícito **"Bloquear Sessão"** no cabeçalho do cartão individual para encerramento instantâneo do acesso após conferir a escala e fazer pedidos.

---

## 🚀 7. Boas Práticas e Diretrizes de Desenvolvimento

1. **Tipagem Estrita**: Centralizar novas interfaces em [types.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/types.ts). Não utilizar `any` indiscriminadamente.
2. **Pureza do Motor Matemático**: As funções em [useScheduleEngine.ts](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/hooks/useScheduleEngine.ts) devem permanecer puras e altamente testáveis.
3. **Persistência Reativa**: Mutação de colaboradores ou parâmetros deve sempre ser realizada via hooks vinculados ao `useLocalStorage` para assegurar o broadcast multi-aba e a sincronização assíncrona com o backend.
4. **Diálogos e Modais**: Usar exclusivamente o hook `useDialog()` de [DialogContext.tsx](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/contexts/DialogContext.tsx) para alertas, confirmações e inputs textuais.
