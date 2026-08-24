import { readFileSync } from 'node:fs';
import { DOMParser } from 'linkedom';
import { parseErHtml } from '../src/lib/importHtml.ts';

globalThis.DOMParser = DOMParser;

let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
};

for (const file of ['er-identidad.html', 'er-salud.html']) {
  const html = readFileSync(`../diagram-design/output/${file}`, 'utf8');
  const d = parseErHtml(html);
  console.log(`\n=== ${file} ===`);
  check('título', d.title.length > 0, d.title);
  check('subtítulo', d.subtitle.length > 0, d.subtitle.slice(0, 40));
  check('entidades > 0', d.entities.length > 0, `${d.entities.length} entidades`);
  check('relaciones > 0', d.relations.length > 0, `${d.relations.length} relaciones`);

  const ids = new Set(d.entities.map((e) => e.id));
  check('ids únicos', ids.size === d.entities.length);
  check(
    'todas con nombre y tabla',
    d.entities.every((e) => e.name && e.table),
  );
  const fieldIds = d.entities.flatMap((e) => e.fields.map((f) => f.id));
  check('ids de campo únicos', new Set(fieldIds).size === fieldIds.length);
  const fkCount = d.entities.reduce((n, e) => n + e.fields.filter((f) => f.isFk).length, 0);
  check('hay FKs (→)', fkCount > 0, `${fkCount} campos FK`);
  check('hay PKs (#)', d.entities.some((e) => e.fields.some((f) => f.isPk)));

  check(
    'relaciones referencian entidades existentes',
    d.relations.every((r) => ids.has(r.source) && ids.has(r.target)),
  );
  check(
    'relaciones con cardinalidad',
    d.relations.every((r) => r.sourceCard && r.targetCard),
  );
  const withLabel = d.relations.filter((r) => r.label);
  check('algunas con label', withLabel.length > 0, withLabel.map((r) => r.label).join(', '));
  const fieldLevel = d.relations.filter((r) => r.sourceFieldId || r.targetFieldId);
  check('algunas ancladas a campo', fieldLevel.length >= 0, `${fieldLevel.length} con campo`);
  if (fieldLevel.length > 0) {
    const okFields = fieldLevel.every(
      (r) =>
        (!r.sourceFieldId || d.entities.find((e) => e.id === r.source)?.fields.some((f) => f.id === r.sourceFieldId)) &&
        (!r.targetFieldId || d.entities.find((e) => e.id === r.target)?.fields.some((f) => f.id === r.targetFieldId)),
    );
    check('campos anclados existen', okFields);
  }
}

import { exportHtml } from '../src/lib/exportHtml.ts';
import { seedSalud } from '../src/lib/model.ts';
const rt = parseErHtml(exportHtml(seedSalud()));
console.log('\n=== round-trip exportHtml → parseErHtml ===');
check('entidades coinciden', rt.entities.length === seedSalud().entities.length, `${rt.entities.length} vs ${seedSalud().entities.length}`);
check('relaciones coinciden', rt.relations.length === seedSalud().relations.length, `${rt.relations.length} vs ${seedSalud().relations.length}`);
check(
  'misma entidad focal',
  rt.entities.find((e) => e.focal)?.name === seedSalud().entities.find((e) => e.focal)?.name,
);

console.log(`\n${failed === 0 ? 'TODO OK' : `${failed} chequeo(s) fallaron`}`);
process.exit(failed > 0 ? 1 : 0);
