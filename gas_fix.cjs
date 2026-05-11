const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist', 'index.html');
const sourcePath = path.join(__dirname, 'index.html'); // source HTML (has Tailwind CDN)
const outputDir = path.join(__dirname, 'appscript_version');

if (!fs.existsSync(distPath)) {
  console.log('❌ dist/index.html not found. Run "npm run build" first.');
  process.exit(1);
}

let html = fs.readFileSync(distPath, 'utf8');

// Read the source index.html to get the original Tailwind config
let sourceHtml = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '';
const twConfigMatch = sourceHtml.match(/tailwind\.config\s*=\s*\{[\s\S]*?\n\s*\}/);
const tailwindConfigScript = twConfigMatch ? twConfigMatch[0] : 'tailwind.config = { darkMode: "class" }';

console.log('Applying GAS Fragmented Build Fixes...');

// ── STEP 1: Extract all scripts from the dist HTML ─────────────────────────
const mainScripts = [];
html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
  const trimmed = content.trim();
  // Skip empty scripts and the inline Tailwind config (we use source version)
  if (trimmed.length > 10 && !trimmed.includes('tailwind.config')) {
    mainScripts.push(trimmed);
  }
  return '<!-- SCRIPT_PLACEHOLDER -->';
});

// ── STEP 2: Build the JavaScript bundle ─────────────────────────────────────
let bundleJs = mainScripts.join('\n');

// Remove ES module exports (incompatible with GAS non-module scripts)
bundleJs = bundleJs.replace(/export default ([a-zA-Z0-9_$]+)\(\);?/g, '$1();');
bundleJs = bundleJs.replace(/^export default .*$/gm, '');

// CRITICAL: Replace template literals (backticks) — GAS sandbox blocks them
bundleJs = bundleJs.replace(/`([^`]*)`/g, (match, content) => {
  const replaced = content.replace(/\$\{([^}]+)\}/g, '" + ($1) + "');
  return '"' + replaced + '"';
});

// ── STEP 3: Build the Index.html ────────────────────────────────────────────
// Remove all script placeholders
html = html.replace(/<!-- SCRIPT_PLACEHOLDER -->/g, '');

// Inject Tailwind CDN + config into <head> (always present)
const tailwindBlock =
  '    <script src="https://cdn.tailwindcss.com"></script>\n' +
  '    <script>\n' +
  tailwindConfigScript + '\n' +
  '    </script>\n';

html = html.replace('</head>', tailwindBlock + '</head>');

// Move root div + Bundle include to end of body
const rootMatch = html.match(/<div id="root"><\/div>/i) || html.match(/<div id="root">\s*<\/div>/i);
if (rootMatch) {
  const rootDiv = rootMatch[0];
  html = html.replace(rootDiv, ''); // remove from current position

  const scriptInclude = '<?!= include("Bundle"); ?>';

  if (html.includes('</body>')) {
    html = html.replace('</body>', `    ${rootDiv}\n    ${scriptInclude}\n</body>`);
  } else {
    html += `\n<body class="antialiased">\n    ${rootDiv}\n    ${scriptInclude}\n</body>\n</html>`;
  }
} else {
  console.warn('⚠️  Could not find <div id="root"> in dist HTML!');
}

// ── STEP 4: Save files ───────────────────────────────────────────────────────
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, 'Index.html'), html, 'utf8');

const bundleHtml = '<script>\n' + bundleJs + '\n</script>';
fs.writeFileSync(path.join(outputDir, 'Bundle.html'), bundleHtml, 'utf8');

const indexSize = fs.statSync(path.join(outputDir, 'Index.html')).size;
const bundleSize = fs.statSync(path.join(outputDir, 'Bundle.html')).size;
const backtickLines = bundleHtml.split('\n').filter(l => l.includes('`')).length;

console.log('✅ GAS Fragmented version updated!');
console.log(`   - appscript_version/Index.html  (${(indexSize/1024).toFixed(1)} KB)`);
console.log(`   - appscript_version/Bundle.html (${(bundleSize/1024).toFixed(1)} KB)`);
console.log(`   - Remaining backtick lines in Bundle: ${backtickLines}`);
