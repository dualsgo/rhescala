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

## Usage Workflow

1. Start by navigating to the **Team (Equipe)** view to add your current staff.
2. Ensure you mark "Jovem Aprendiz" appropriately and set their weekly course days.
3. Once the team is configured, navigate to the **Dashboard (Escala)**. The system will auto-generate the current month's shifts based on preferred days off and Sunday rotation logic.
4. Manually click on shifts and daily hours in the grid to make specific adjustments or log absences.
5. Use the WhatsApp Share button to quickly communicate daily schedules to the team.
