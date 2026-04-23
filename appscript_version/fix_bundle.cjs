const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Index.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Find the React bundle script
const scriptRegex = /<script type="module" crossorigin>([\s\S]*?)<\/script>/;
const match = content.match(scriptRegex);

if (match) {
  const jsCode = match[1];
  // Convert to Base64 carefully to preserve UTF-8
  const b64 = Buffer.from(jsCode, 'utf8').toString('base64');
  
  const loader = `
  <script>
    (function() {
      // Robust Base64 to UTF-8 decoding for GAS
      function b64DecodeUnicode(str) {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      }

      function injectBundle() {
        try {
          var decoded = b64DecodeUnicode("${b64}");
          var script = document.createElement('script');
          script.type = 'text/javascript';
          script.textContent = decoded;
          document.body.appendChild(script);
          
          // Remove loading indicator if exists
          var loader = document.getElementById('gas-loader');
          if (loader) loader.style.display = 'none';
        } catch(e) {
          console.error("Injection Error:", e);
          document.body.innerHTML = "<div style='color:red;padding:20px;font-family:sans-serif'><h2>Erro de Inicialização</h2><p>Ocorreu um erro ao carregar o sistema.</p><pre style='background:#fee;padding:10px;border-radius:8px'>" + e.stack + "</pre></div>";
        }
      }

      if (document.readyState === "complete" || document.readyState === "interactive") {
        injectBundle();
      } else {
        window.addEventListener("DOMContentLoaded", injectBundle);
      }
    })();
  </script>`;
  
  // 3. Replace the original script and remove modulepreloads
  content = content.replace(scriptRegex, loader);
  content = content.replace(/<link rel="modulepreload" [^>]*>/g, '');
  
  // 4. Add a basic loader UI in the body
  if (!content.includes('id="gas-loader"')) {
    content = content.replace('<div id="root"></div>', '<div id="gas-loader" style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#64748b;flex-direction:column;gap:16px"><div style="width:40px;height:40px;border:4px solid #f1f5f9;border-top:4px solid #f97316;border-radius:50%;animation:spin 1s linear infinite"></div><p>Carregando Escala...</p><style>@keyframes spin {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style></div><div id="root"></div>');
  }

  fs.writeFileSync(filePath, content);
  console.log('✅ Bundle fixed: Base64 UTF-8 applied with robust loader.');
} else {
  console.error('❌ Error: Could not find the React script tag.');
}
