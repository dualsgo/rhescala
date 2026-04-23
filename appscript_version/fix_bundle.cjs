const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Index.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Find the React bundle script
const scriptRegex = /<script type="module" crossorigin>([\s\S]*?)<\/script>/;
const match = content.match(scriptRegex);

if (match) {
  const jsCode = match[1];
  const b64 = Buffer.from(jsCode).toString('base64');
  
  // 2. Create a loader that waits for the DOM
  // We use atob and document.body.appendChild to ensure it runs after the root div is parsed.
  const loader = `
  <script>
    (function() {
      function injectBundle() {
        try {
          var decoded = atob("${b64}");
          var script = document.createElement('script');
          script.textContent = decoded;
          document.body.appendChild(script);
        } catch(e) {
          document.body.innerHTML = "<div style='color:red;padding:20px'><h2>Erro de Injeção</h2><pre>" + e.toString() + "</pre></div>";
        }
      }
      if (document.readyState === "complete" || document.readyState === "interactive") {
        injectBundle();
      } else {
        window.addEventListener("DOMContentLoaded", injectBundle);
      }
    })();
  </script>`;
  
  // 3. Replace the original script and remove modulepreloads (GAS hates them)
  content = content.replace(scriptRegex, loader);
  content = content.replace(/<link rel="modulepreload" [^>]*>/g, '');
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Bundle fixed: Base64 applied with deferred execution.');
} else {
  console.error('❌ Error: Could not find the React script tag.');
}
