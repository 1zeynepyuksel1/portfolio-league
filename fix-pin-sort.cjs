const fs = require('fs');
let service = fs.readFileSync('apps/api/src/posts/service.ts', 'utf8');

// Use COALESCE to treat NULL as false, and cast string 'true'/'false' to boolean so sorting is strict
const oldOrderBy = "orderBy: [desc(sql\\->>'isPinned'\), desc(posts.createdAt)],";
const newOrderBy = "orderBy: [sql\COALESCE((\->>'isPinned')::boolean, false) DESC\, desc(posts.createdAt)],";

if (service.includes(oldOrderBy)) {
  service = service.replace(oldOrderBy, newOrderBy);
} else {
  // Try alternative regex matching
  service = service.replace(/orderBy:\s*\[desc\(sql.*?isPinned.*?\), desc\(posts\.createdAt\)\]/, "orderBy: [sql\COALESCE((->>'isPinned')::boolean, false) DESC\, desc(posts.createdAt)]");
}

fs.writeFileSync('apps/api/src/posts/service.ts', service, 'utf8');
