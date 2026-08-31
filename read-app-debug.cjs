const fs = require('fs');
let app = fs.readFileSync('apps/mobile/App.tsx', 'utf8');
const lines = app.split('\n');
console.log(lines.slice(120, 150).join('\n'));
