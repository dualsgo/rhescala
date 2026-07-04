const fs = require('fs');
let text = fs.readFileSync('App.tsx', 'utf8');

text = text.replace(/import \{ generateYearSchedule, applyMonthUpdate, resolveTacticalDay, calculateLunches, getShiftClassification, findSundayViolations, isWorkingShift, distributeTacticalPositions \} from '\.\/hooks\/useS\[\.\.\.\]/, "import { generateYearSchedule, applyMonthUpdate, resolveTacticalDay, calculateLunches, getShiftClassification, findSundayViolations, isWorkingShift, distributeTacticalPositions } from './hooks/useScheduleEngine';");

text = text.replace(/const \[currentView, setCurrentView\] = useState<'grid' \| 'analysis' \| 'team' \| 'jornada' \| 'data' \| 'feriados' \| 'worked-holidays' \| 'cleaning' \| 'patrol' \| 'sections' \| 'activities' \| 'routine' \[\.\.\.\]/, "const [currentView, setCurrentView] = useState<string>('grid');");

text = text.replace(/const isHoliday = buildHolidaySet\(currentMY.year, customHolidays, deletedNationalHolidays\).has\(`\$\{currentMY.year\}-\$\{String\(currentMY.month \+ 1\).padStart\(2, '0'\)\}-\$\{String\(dayIdx \+ 1\).padSta\[\.\.\.\]/, "const isHoliday = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays).has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`);");

text = text.replace(/shadow-amber-50\[\.\.\.\]/g, 'shadow-amber-500/10"');
text = text.replace(/bg-slate-100 d\[\.\.\.\]/g, 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Voltar</button>');
text = text.replace(/shadow-md ac\[\.\.\.\]/g, 'shadow-md active:scale-95"');
text = text.replace(/shadow-md \[\.\.\.\]/g, 'shadow-md active:scale-95"');
text = text.replace(/whitespace-pre-wrap\[\.\.\.\]/g, 'whitespace-pre-wrap"');
text = text.replace(/dark:hover:bg-green-\[\.\.\.\]/g, 'dark:hover:bg-green-800 transition-all active:scale-95"');
text = text.replace(/dark:border-zin\[\.\.\.\]/g, 'dark:border-zinc-800 rounded-full p-2 shadow-2xl shadow-black/20"');
text = text.replace(/shadow-indigo-500\/20' : 'b\[\.\.\.\]/g, "shadow-indigo-500/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300'}`}");

fs.writeFileSync('App.tsx', text);
