const ts = require('typescript');

const fs = require('fs');

const typesStr = fs.readFileSync('types.ts', 'utf8');
const constantsStr = fs.readFileSync('constants.ts', 'utf8');
const engineSrc = fs.readFileSync('hooks/useScheduleEngine.ts', 'utf8');

// It's easier to just paste a mocked applyMonthUpdate here to test it.
const engine = `
const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function getTargetHours() { return "10h"; }

function buildHolidaySet() { return new Set(); }

function isSundayUnavailable(emp, dateStr, monthKey, dayIdx) { return false; }

function getPrevMonthConsecutive() { return new Map(); }
function buildSundayAssignments() { return { assignments: new Map(), nextConsecutive: new Map() }; }
function getPrevMonthWorkStreak() { return new Map(); }

function applyMonthUpdate(employees, year, month) {
    const result = {};

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthKey = \`\${year}-\${String(month + 1).padStart(2, '0')}\`;

    const prevStreaks = new Map();
    activeRegular.forEach(emp => {
        const newShifts = Array(daysInMonth).fill('T');

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const dateStr = \`\${year}-\${String(month + 1).padStart(2, '0')}-\${String(dayIdx + 1).padStart(2, '0')}\`;

            if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
                newShifts[dayIdx] = 'FE'; continue;
            }
        }

        let currentStreak = 0;

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const shift = newShifts[dayIdx];
            if (shift === 'FE' || shift === 'F') {
                currentStreak = 0;
                continue;
            }

            currentStreak++;
            if (currentStreak > 6) {
                newShifts[dayIdx] = 'F';
                currentStreak = 0;
            } else {
                const dow = new Date(year, month, dayIdx + 1).getDay();
                if (WEEKDAY_NAMES[dow] === emp.preferredDayOff) {
                    newShifts[dayIdx] = 'F';
                    currentStreak = 0;
                }
            }
        }

        result[emp.id] = { shifts: newShifts };
    });

    return result;
}

const employees = [
  { id: '1', status: 'active', isYoungApprentice: false, preferredDayOff: 'Segunda-feira', vacationStart: '2026-04-10', vacationEnd: '2026-05-10', shifts: {} }
];

console.log(applyMonthUpdate(employees, 2026, 3));
`;

fs.writeFileSync('verify-exec.js', engine);
