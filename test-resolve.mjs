import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
  const path = require.resolve('pdf-parse');
  console.log("Resolved path:", path);
} catch (err) {
  console.error("Resolve failed:", err.message);
}
