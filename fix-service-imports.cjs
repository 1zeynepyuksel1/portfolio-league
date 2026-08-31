const fs = require('fs');
let service = fs.readFileSync('apps/api/src/posts/service.ts', 'utf8');

service = service.replace(
  "export async function updatePostCaption(postId: string, userId: string, caption: string) {\\n  const result",
  "export async function updatePostCaption(postId: string, userId: string, caption: string) {\n  const { eq, and } = await import('drizzle-orm');\n  const result"
);
service = service.replace(
  "export async function updatePostCaption(postId: string, userId: string, caption: string) {\\r\\n  const result",
  "export async function updatePostCaption(postId: string, userId: string, caption: string) {\n  const { eq, and } = await import('drizzle-orm');\n  const result"
);

// Fallback regex
service = service.replace(/export async function updatePostCaption\(postId: string, userId: string, caption: string\) \{\s*const result/, "export async function updatePostCaption(postId: string, userId: string, caption: string) {\n  const { eq, and } = await import('drizzle-orm');\n  const result");

fs.writeFileSync('apps/api/src/posts/service.ts', service, 'utf8');
