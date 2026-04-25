const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('appscript_version/Index.html', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (err) => {
  console.error("JSDOM Error:", err);
});
virtualConsole.on("log", (log) => {
  console.log("JSDOM Log:", log);
});
virtualConsole.on("jsdomError", (err) => {
  console.error("jsdomError:", err);
});

const dom = new JSDOM(html, { 
  runScripts: "dangerously", 
  virtualConsole,
  url: "http://localhost/"
});

setTimeout(() => {
  console.log("Root content length:", dom.window.document.getElementById('root').innerHTML.length);
  console.log("Body length:", dom.window.document.body.innerHTML.length);
}, 2000);
