# 🎪 Rhescala — Ri Happy Shift Management

> **Sistema Inteligente de Gestão de Escalas, Rotinas Operacionais e Conformidade CLT para o Varejo Ri Happy**

O **Rhescala** é uma aplicação web progressiva (PWA) de alta performance desenvolvida para automatizar, auditar e gerenciar escalas de trabalho e rotinas operacionais da rede **Ri Happy**, contando com uma suíte completa de testes automatizados (Vitest) e sincronização resiliente com Google Sheets (via Google Apps Script).

---

## 🚀 Principais Recursos

### 📅 Gestão e Inteligência de Escalas (`src/engine/`)
- **Motor CLT 6x1 e 5x2 (`clt-rules.ts` & `month-generator.ts`)**: Cálculo automático e auditoria contínua de ciclos de trabalho e folga com rotação contínua e *carryover* inter-meses.
- **Regra de Domingos (`sunday-rotation.ts`)**: Teto de no máximo 2 domingos consecutivos trabalhados com garantia do efetivo mínimo (`minSundayWorkers`).
- **Jovem Aprendiz**: Jornada fixa (10h às 16h15), descanso obrigatório em fins de semana e feriados, e dia de curso teórico (`C`).
- **Posições Táticas de Loja (`tactical-positions.ts`)**: Alocação por cargo e preferência (`P1` Caixa, `PC` Pacote, `P2` Recepção/Porta, `P3` Salão, `P4` Apoio, `ESTQ` Estoque).
- **Intervalos de Almoço Escalonados (`lunch-scheduler.ts`)**: Algoritmo que distribui pausas de refeição para evitar desfalques no atendimento.
- **Otimização de Semanas de Pico (`seasonal-peaks.ts` & `protected-days.ts`)**: Motor inteligente para Dia das Crianças, Black Friday, Natal e dias protegidos com presença máxima.

### 🛡️ Auditoria e Conformidade
- **Detecção de Inconsistências em Tempo Real (`InconsistencyPanel.tsx`)**: Alertas visuais e resolução em 1 clique para violações de 6x1, estouro de domingos e desfalques.
- **Ciclo Rascunho vs. Oficial com Snapshots (`schedule-diff.ts` & `ScheduleDiffModal.tsx`)**: Congelamento de versão oficial e auditoria pós-oficialização com exportação de divergências para WhatsApp.
- **Créditos de Feriado (`FF` — `HolidayCreditsTable.tsx` & `WorkedHolidaysList.tsx`)**: Controle de folgas compensatórias de feriados trabalhados, incluindo a regra do 1º de Maio (2 créditos).

### 🏪 Rotinas Operacionais de Loja
- **Escala de Limpeza da Copa (`CleaningSchedule.tsx` & `cleaning-rotation.ts`)**: Sorteio balanceado com 1 responsável por dia e exportação em imagem PNG.
- **Escala de Ronda e Patrulhamento (`PatrolSchedule.tsx`)**: Divisão diária de fiscais e responsáveis por turno (Abertura e Fechamento).
- **Setorização Quinzenal de Brinquedos (`SectionManager.tsx`)**: Distribuição equilibrada de áreas de loja entre turnos.
- **Avisos e Checklists Operacionais (`OperationalNotices.tsx` & `EssentialActivities.tsx`)**: Comunicação diária e rotinas essenciais de abertura e fechamento.

### 📱 Experiência Mobile First para Colaboradores
- **Modo Colaborador (`MobileEmployerViewer.tsx` & `MobileDayScheduleView.tsx`)**: Abas "Hoje", "Semana", "Equipe", "Mês" e "Pedidos" com filtro rápido de presentes (`working-only`).
- **Acesso Individual com Senha (`Login.tsx` & `RequestManager.tsx`)**: Consulta de escala individual e envio de solicitações de folga ou trocas de turno.

### 💾 Persistência e Sincronização (`src/infrastructure/`)
- **Offline-First (`persistenceCoordinator.ts` & `syncQueue.ts`)**: Cache instantâneo em `localStorage`, fila de sincronização resiliente com *retry* automático e resolução de conflitos.
- **Google Sheets & Google Apps Script (`google_drive_appscript/`)**: Backend serverless NoSQL em abas de planilha Google.
- **Node.js Express API Opcional (`server/`)**: Backend alternativo com suporte a MongoDB Atlas.

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS, Vite 6
- **Testes Automatizados**: Vitest + React Testing Library (`tests/` com +25 suítes de testes cobrindo motor CLT, almoço, sincronização e UI)
- **Exportação & Mídia**: `html-to-image`, `jspdf`, `xlsx`, CSV (`exportScheduleCsv.ts`)
- **Backend Serverless**: Google Apps Script (GAS) com Google Sheets

---

## 💻 Comandos e Execução

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Executar suíte de testes automatizados
npm test

# Checagem de tipos TypeScript
npx tsc --noEmit

# Build de produção
npm run build

# Build para Google Apps Script (Singlefile)
npm run gas-build
```

---

## 🔒 Privacidade e LGPD
Planilhas Excel (`.xlsx`, `.xls`, `.csv`) e documentos HTML avulsos contendo dados pessoais ou médicos de colaboradores são estritamente ignorados pelo Git (`.gitignore`) e foram removidos do diretório de trabalho.

---

## 📖 Documentação de Arquitetura
Consulte o arquivo [`.agents/AGENTS.md`](file:///c:/Users/mdbsi/OneDrive/Documentos/GitHub/rhescala/.agents/AGENTS.md) para detalhes técnicos de arquitetura, contratos de tipos e especificação do motor matemático.
