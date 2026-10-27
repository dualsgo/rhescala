import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import esbuild from 'esbuild';
import babel from '@babel/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const adaptersDir = path.resolve(__dirname, 'adapters');
const tmpOutDir = path.resolve(__dirname, '.tmp_build');

const targetGasApi = path.resolve(repoRoot, 'src/gas-api.ts');
const adapterGasApi = path.resolve(adaptersDir, 'gas-api.ts');

const targetLogin = path.resolve(repoRoot, 'components/Login.tsx');
const adapterLogin = path.resolve(adaptersDir, 'LoginDrive.tsx');

const targetDataManager = path.resolve(repoRoot, 'components/DataManager.tsx');
const adapterDataManager = path.resolve(adaptersDir, 'DataManagerDrive.tsx');

const targetOpGuide = path.resolve(repoRoot, 'components/OperationalGuideModal.tsx');
const targetWorkedHolidays = path.resolve(repoRoot, 'components/WorkedHolidaysList.tsx');

const entryDrive = path.resolve(adaptersDir, 'entry-drive.tsx');

const VIRTUAL_EMPTY_GUIDE = '\0rhescala-empty-guide';
const VIRTUAL_EMPTY_WORKED = '\0rhescala-empty-worked';

function normalizeSlashes(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Plugin Vite que redireciona imports de rede/login/dados para os adaptadores nativos
 * do Google Drive e poda modais secundários pesados SEM alterar nenhum arquivo original.
 */
function gasDriveOverlayPlugin() {
  const normAdaptersDir = normalizeSlashes(adaptersDir);
  const normGasApi = normalizeSlashes(targetGasApi).replace(/\.ts$/, '');
  const normLogin = normalizeSlashes(targetLogin).replace(/\.tsx$/, '');
  const normDataMgr = normalizeSlashes(targetDataManager).replace(/\.tsx$/, '');
  const normOpGuide = normalizeSlashes(targetOpGuide).replace(/\.tsx$/, '');
  const normWorked = normalizeSlashes(targetWorkedHolidays).replace(/\.tsx$/, '');

  return {
    name: 'rhescala-gas-drive-overlay',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === VIRTUAL_EMPTY_GUIDE || source === VIRTUAL_EMPTY_WORKED) return source;
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;

      const cleanId = normalizeSlashes(resolved.id).split('?')[0].replace(/\.(ts|tsx)$/, '');
      const cleanImporter = normalizeSlashes(importer);
      const fromInsideAdapters = cleanImporter.startsWith(normAdaptersDir);

      if (cleanId === normGasApi) return adapterGasApi;
      if (cleanId === normOpGuide) return VIRTUAL_EMPTY_GUIDE;
      if (cleanId === normWorked) return VIRTUAL_EMPTY_WORKED;
      if (!fromInsideAdapters && cleanId === normLogin) return adapterLogin;
      if (!fromInsideAdapters && cleanId === normDataMgr) return adapterDataManager;
      return null;
    },
    load(id) {
      if (id === VIRTUAL_EMPTY_GUIDE) {
        return 'export const OperationalGuideModal = () => null; export default OperationalGuideModal;';
      }
      if (id === VIRTUAL_EMPTY_WORKED) {
        return 'export const WorkedHolidaysList = () => null; export default WorkedHolidaysList;';
      }
      return null;
    },
  };
}

/**
 * Quebra linhas longas (~500 colunas) EXCLUSIVAMENTE em tokens reais ';' ',' '{' do AST Babel,
 * garantindo tamanho mínimo (minify completo) + linhas curtas seguras para colar no editor GAS.
 */
function wrapMinifiedJsByAstTokens(code, maxLineCols = 500) {
  const ast = babel.parseSync(code, {
    parserOpts: { tokens: true },
    configFile: false,
    babelrc: false,
  });
  const tokens = ast && ast.tokens ? ast.tokens : [];
  if (!tokens.length) return code;

  const chunks = [];
  let sliceStart = 0;
  let lineStart = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const label = tok.type && tok.type.label;
    if (tok.end - lineStart >= maxLineCols && (label === ';' || label === ',' || label === '{')) {
      chunks.push(code.slice(sliceStart, tok.end));
      sliceStart = tok.end;
      lineStart = tok.end;
    }
  }
  if (sliceStart < code.length) {
    chunks.push(code.slice(sliceStart));
  }
  return chunks.join('\n');
}

async function main() {
  console.log('1/3 Compilando versão enxuta (Grade + Configurações + Lógicas) para Google Apps Script...');

  if (fs.existsSync(tmpOutDir)) {
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
  }

  await build({
    configFile: false,
    root: repoRoot,
    logLevel: 'warn',
    plugins: [gasDriveOverlayPlugin(), react()],
    resolve: {
      alias: {
        '@': repoRoot,
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      target: 'es2018',
      minify: 'esbuild',
      sourcemap: false,
      outDir: tmpOutDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      rollupOptions: {
        input: entryDrive,
        output: {
          format: 'iife',
          name: 'RhescalaDriveApp',
          entryFileNames: 'bundle.js',
          inlineDynamicImports: true,
        },
      },
    },
  });

  const bundlePath = path.join(tmpOutDir, 'bundle.js');
  if (!fs.existsSync(bundlePath)) {
    throw new Error('bundle.js não foi gerado pelo Vite.');
  }

  const rawBundleJs = fs.readFileSync(bundlePath, 'utf8');

  const extraCssFiles = fs.readdirSync(tmpOutDir).filter((f) => f.endsWith('.css'));
  let extraCss = '';
  for (const cssFile of extraCssFiles) {
    extraCss += '\n' + fs.readFileSync(path.join(tmpOutDir, cssFile), 'utf8');
  }

  fs.rmSync(tmpOutDir, { recursive: true, force: true });

  // Passada extra do esbuild para eliminar comentários de licença, minificar sintaxe e remover crases via AST
  const transformed = esbuild.transformSync(rawBundleJs, {
    target: 'es2018',
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    legalComments: 'none',
    supported: {
      'template-literal': false,
    },
  });

  // Quebra em linhas curtas (~500 chars) usando os offsets exatos de tokens do parser Babel
  const wrappedJs = wrapMinifiedJsByAstTokens(transformed.code, 500);

  // Escapa TODAS as sequências que quebram o parser HTML do HtmlService (ex: "<script></script>" interno do React 19)
  const safeBundleJs = wrappedJs
    .replace(/<(\/?script)/gi, '\\x3c$1')
    .replace(/<!--/g, '\\x3c!--')
    .replace(/<\/style/gi, '\\x3c/style');

  console.log('2/3 Validando sintaxe JavaScript e blindagem HTML do bundle (vm.Script)...');
  new vm.Script(safeBundleJs, { filename: 'Index-bundle.js' });

  if (/<\/?script|<!--/i.test(safeBundleJs)) {
    throw new Error('Ainda restam sequências <script ou <!-- não escapadas no bundle!');
  }

  console.log('3/3 Montando Index.html otimizado para o Google Apps Script...');
  const baseHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

  const styleMatch = baseHtml.match(/<style>[\s\S]*?<\/style>/i);
  const baseStyles = styleMatch ? styleMatch[0] : '';
  const twScriptMatch = baseHtml.match(/<script>\s*(tailwind\.config[\s\S]*?)<\/script>/i);
  const twConfig = twScriptMatch
    ? twScriptMatch[1].trim()
    : "tailwind.config = { darkMode: 'class', theme: { extend: { fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] } } } };";

  const finalHtml = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Rhescala — Gestão de Escalas (Google Drive)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        if (typeof tailwind !== 'undefined') {
            ${twConfig}
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" crossorigin="anonymous">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" crossorigin="anonymous" />
    <style>
        @keyframes rhescalaSpin { to { transform: rotate(360deg); } }
    </style>
    ${baseStyles}
    ${extraCss ? `<style>\n${extraCss}\n</style>` : ''}
</head>
<body class="antialiased" style="margin:0;padding:0;">
    <div id="root">
        <div style="min-height:100vh;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;padding:24px;text-align:center;">
            <div style="width:42px;height:42px;border:4px solid rgba(249,115,22,0.25);border-top-color:#f97316;border-radius:9999px;animation:rhescalaSpin 0.8s linear infinite;margin-bottom:14px;"></div>
            <div style="font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#a1a1aa;">Inicializando Rhescala...</div>
        </div>
    </div>
    <script>
        window.__rhescalaReportFatal = function(msg) {
            var root = document.getElementById('root');
            if (!root) return;
            root.innerHTML = '<div style="min-height:100vh;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;padding:24px;font-family:sans-serif;">' +
                '<div style="max-width:560px;width:100%;background:#1e293b;border:1px solid #334155;border-radius:20px;padding:28px;">' +
                '<h2 style="margin:0 0 8px 0;font-size:18px;color:#fff;">Falha ao iniciar interface</h2>' +
                '<p style="margin:0 0 14px 0;font-size:13px;color:#94a3b8;">Verifique se o código de Index.html foi colado até a última linha (&lt;/html&gt;).</p>' +
                '<pre style="background:#020617;color:#fda4af;padding:12px;border-radius:10px;font-size:12px;overflow:auto;white-space:pre-wrap;">' +
                String(msg || 'Erro desconhecido').replace(/</g, '&lt;') +
                '</pre></div></div>';
        };
        window.addEventListener('error', function(ev) {
            if (!window.__RHESCALA_MOUNTED__) {
                window.__rhescalaReportFatal((ev && (ev.message || (ev.error && ev.error.stack))) || 'Erro de script');
            }
        });
    </script>
    <script>
${safeBundleJs}
window.__RHESCALA_MOUNTED__ = true;
    </script>
</body>
</html>
`;

  const outputHtmlPath = path.join(__dirname, 'Index.html');
  fs.writeFileSync(outputHtmlPath, finalHtml, 'utf8');

  const lines = finalHtml.split('\n');
  const maxLineLen = lines.reduce((max, l) => (l.length > max ? l.length : max), 0);
  const scriptOpenCount = (finalHtml.match(/<script/gi) || []).length;
  const scriptCloseCount = (finalHtml.match(/<\/script>/gi) || []).length;
  const backtickCount = (safeBundleJs.match(/`/g) || []).length;
  const htmlSizeKb = (fs.statSync(outputHtmlPath).size / 1024).toFixed(1);
  const gsSizeKb = (fs.statSync(path.join(__dirname, 'Code.gs')).size / 1024).toFixed(1);

  console.log('✅ Conversão concluída com sucesso!');
  console.log(`   • google_drive_appscript/Code.gs    (${gsSizeKb} KB)`);
  console.log(`   • google_drive_appscript/Index.html (${htmlSizeKb} KB | linhas: ${lines.length} | maior linha: ${maxLineLen} chars)`);
  console.log(`   • Integridade HTML: <script=${scriptOpenCount}, </script>=${scriptCloseCount}, crases restantes=${backtickCount}`);
}

main().catch((err) => {
  console.error('❌ Erro ao gerar versão Apps Script:', err);
  process.exit(1);
});
