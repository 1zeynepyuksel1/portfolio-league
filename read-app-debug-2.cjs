const fs = require('fs');
let app = fs.readFileSync('apps/mobile/App.tsx', 'utf8');
const lines = app.split('\n');
console.log(lines.slice(250, 310).join('\n'));
