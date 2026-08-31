const fs = require('fs');
let astro = fs.readFileSync('apps/mobile/src/components/AstroTab.tsx', 'utf8');

astro = "import { SharePostModal, ShareScope } from './SharePostModal';\n" + astro;

fs.writeFileSync('apps/mobile/src/components/AstroTab.tsx', astro, 'utf8');
