# Ri Happy Shift Management (Escala Diária)

A smart, responsive web application built with React and Vite to manage and automate shift scheduling for retail employees, specifically tailored for the needs of Ri Happy stores. It manages the scheduling of regular employees (CLT) and Young Apprentices (Jovem Aprendiz) according to Brazilian labor rules.

## Features

- **Automated Schedule Generation:** Intelligently auto-generates monthly schedules following strict labor rules (e.g., maximum 2 consecutive Sundays, minimum CLT staff on Sundays, apprentices off on weekends and course days).
- **Interactive Shift Grid:** A visual dashboard to view, and edit employee shifts, schedule hours, and absences day by day.
- **Team Management:** Add, edit, or remove employees, managing their details like role, preferred days off, and work periods.
- **Holiday Manager:** Manage both national and custom state/municipal holidays effortlessly to adjust automatic scheduling logic.
- **WhatsApp Integration:** Easily copy and share the daily schedule grouped by shift (Abertura, Intermediário, Fechamento) and list absent employees directly to WhatsApp.
- **Local Storage & Backup:** All data is persisted securely via `localStorage`. Easily export (backup) and import your store's schedule data as JSON.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- npm or yarn

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview the production build:**
   ```bash
   npm run preview
   ```

## Technologies Used

- **React 19** with Hooks
- **Vite** for fast, optimized builds
- **Tailwind CSS** for responsive, modern styling
- **TypeScript** for strict type-checking and stable architecture

## Multi-Store Setup (Google Sheets Backend)

Este projeto utiliza um backend baseado em Google Apps Script (GAS) para permitir que cada loja tenha seu próprio banco de dados em uma planilha Google.

### Passos para configurar uma nova loja:

1. **Criar Planilha:** Crie uma nova Planilha Google em branco. Não se preocupe com o nome das abas (como "Página1"), o script as criará automaticamente.
2. **Abrir Editor de Script:** Vá em `Extensões` > `Apps Script`.
3. **Copiar Código:** Copie o código disponível no arquivo `src/constants/appsScriptCode.ts` (ou o código fornecido pelo administrador) e cole no editor do Google.
4. **Implantar (Deploy):**
   - Clique em `Implantar` > `Nova Implantação`.
   - Tipo: `App da Web`.
   - Descrição: `API Escala`.
   - Executar como: `Eu` (seu e-mail).
   - Quem tem acesso: `Qualquer pessoa`.
5. **Autorizar:** Clique em `Implantar` e siga as janelas de autorização do Google.
6. **Configurar na App:** Copie a **URL do App da Web** gerada e cole-a na tela de configuração inicial do sistema.

---
© 2024 Ri Happy - Gestão de Escalas
