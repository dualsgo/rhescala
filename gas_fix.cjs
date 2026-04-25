const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'dist', 'index.html');

if (fs.existsSync(filePath)) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Remove module type from script
  html = html.replace(/<script type="module" crossorigin/g, '<script defer');
  
  // Remove export default from the end of the bundled code
  html = html.replace(/export default ([a-zA-Z0-9_$]+)\(\);/g, '$1();');
  html = html.replace(/export default ([a-zA-Z0-9_$]+);/g, '');
  
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('GAS Compatibility Fix Applied to dist/index.html');
} else {
  console.log('dist/index.html not found, skipping postbuild fix.');
}
