# 🎪 Rhescala — Ri Happy Shift Management

> **Sistema Inteligente de Gestão de Escalas, Rotinas Operacionais e Conformidade CLT para o Varejo Ri Happy**

O **Rhescala** é uma aplicação web progressiva (PWA) de alta performance desenvolvida para automatizar, auditar e gerenciar escalas de trabalho e rotinas operacionais da rede **Ri Happy**.

---

## 🚀 Principais Recursos

### 📅 Gestão e Inteligência de Escalas
- **Motor CLT 6x1 e 5x2**: Cálculo automático e auditoria contínua de ciclos de trabalho e folga com rotação contínua e carryover inter-meses.
- **Regra de Domingos**: Teto de no máximo 2 domingos consecutivos trabalhados com garantia do efetivo mínimo (`minSundayWorkers`).
- **Jovem Aprendiz**: Jornada fixa (10h às 16h15), descanso obrigatório em fins de semana e feriados, e dia de curso teórico (`C`).
- **Posições Táticas de Loja**: Alocação por cargo e preferência (`P1` Caixa, `PC` Pacote, `P2` Recepção/Porta, `P3` Salão, `P4` Apoio, `ESTQ` Estoque).
- **Intervalos de Almoço Escalonados**: Algoritmo que distribui pausas de refeição para evitar desfalques no atendimento.
- **Otimização de Semanas de Pico**: Motor inteligente para Dia das Crianças, Black Friday, Natal e dias protegidos com presença máxima.

### 🛡️ Auditoria e Conformidade
- **Detecção de Inconsistências em Tempo Real**: Alertas visuais e resolução em 1 clique para violações de 6x1, estouro de domingos e desfalques.
- **Ciclo Rascunho vs. Oficial com Snapshots**: Congelamento de versão oficial e auditoria pós-oficialização (`ScheduleDiffItem`) com exportação de divergências para WhatsApp.
- **Créditos de Feriado (`FF`)**: Controle de folgas compensatórias de feriados trabalhados, incluindo a regra do 1º de Maio (2 créditos).

### 🏪 Rotinas Operacionais de Loja
- **Escala de Limpeza da Copa**: Sorteio balanceado com 1 responsável por dia e exportação em imagem PNG.
- **Escala de Ronda e Patrulhamento**: Divisão diária de fiscais e responsáveis por turno (Abertura e Fechamento).
- **Setorização Quinzenal de Brinquedos**: Distribuição equilibrada de áreas de loja entre turnos.
- **Checklists Operacionais**: Rotinas diárias essenciais de abertura e fechamento.

### 📱 Experiência Mobile First para Colaboradores
- **Modo Colaborador (PWA)**: Abas "Hoje", "Semana", "Equipe", "Mês" e "Pedidos".
- **Acesso Individual com Senha**: Cada colaborador pode consultar sua escala individual e enviar solicitações de folga ou trocas de turno.

### 💾 Persistência e Sincronização
- **Offline-First**: Cache instantâneo em `localStorage` e sincronização multi-aba via `BroadcastChannel`.
- **Google Sheets & Google Apps Script**: Backend serverless NoSQL em abas de planilha Google.
- **Node.js Express API Opcional**: Backend alternativo em `server/` com suporte a MongoDB Atlas.
- **Exportação para Vendas**: Exportação de JSON com alocação diária por colaborador para integração com metas e produtividade.

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS, Vite 6
- **Exportação & Mídia**: `html-to-image`, `jspdf`, `xlsx`
- **Backend Serverless**: Google Apps Script (GAS) com Google Sheets
- **Backend API Opcional**: Node.js, Express, MongoDB / Mongoose

---

## 💻 Comandos e Execução

### Instalação de Dependências
```bash
npm install
```

### Execução em Desenvolvimento
```bash
npm run dev
```

### Checagem de Tipos TypeScript
```bash
npx tsc --noEmit
```

### Build de Produção
```bash
npm run build
```

### Build para Google Apps Script (Singlefile)
```bash
npm run gas-build
```

---

## 📖 Documentação de Arquitetura

Consulte o arquivo [.agents/AGENTS.md](file:///.agents/AGENTS.md) para detalhes técnicos de arquitetura, contratos de tipos, mapeamento completo de componentes e especificação do motor matemático.
