import { copyFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPath = resolve(root, 'supabase/data/pc-question-bank.v1.json');
const functionPath = resolve(root, 'supabase/functions/_shared/pc-question-bank.v1.json');

const canonical = await readFile(canonicalPath, 'utf8');
JSON.parse(canonical);
await copyFile(canonicalPath, functionPath);
console.log('Acervo sincronizado para a Edge Function.');
