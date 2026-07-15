/**
 * Export diagnostic template metadata for backend PDF generation.
 * Run: node frontend/scripts/exportDiagnosticCatalog.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../constants/diagnosticTemplates.js');
const outPath = path.join(__dirname, '../../backend/app/data/diagnostic_template_catalog.json');

const src = fs.readFileSync(srcPath, 'utf8');
const templatesStart = src.indexOf('export const DIAGNOSTIC_TEMPLATES');
const helpersStart = src.indexOf('const tri =');
const arrayEnd = src.indexOf('];', templatesStart) + 2;

if (helpersStart < 0 || templatesStart < 0 || arrayEnd <= templatesStart) {
  console.error('Could not locate DIAGNOSTIC_TEMPLATES in diagnosticTemplates.js');
  process.exit(1);
}

const chunk = `${src.slice(helpersStart, templatesStart)}var DIAGNOSTIC_TEMPLATES = ${src.slice(
  src.indexOf('[', templatesStart),
  arrayEnd,
)};`;

const sandbox = {};
vm.runInNewContext(chunk, sandbox);

const catalog = sandbox.DIAGNOSTIC_TEMPLATES.map((t) => ({
  id: t.id,
  label: t.label,
  sections: (t.sections || []).map((s) => ({
    id: s.id,
    title: s.title,
    fields: (s.fields || []).map((f) => ({ id: f.id, label: f.label, type: f.type })),
  })),
}));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${catalog.length} templates to ${outPath}`);
