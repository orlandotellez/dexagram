import { readFileSync, writeFileSync } from 'node:fs';
import { seedSalud } from '../src/lib/model.ts';
import { exportHtml } from '../src/lib/exportHtml.ts';

const html = exportHtml(seedSalud());
writeFileSync('/tmp/dexagram-export-test.html', html);

const checks = [
  ['role="img"', html.includes('role="img"')],
  ['aria-labelledby', html.includes('aria-labelledby="diagram-title diagram-desc"')],
  ['<title> como primer hijo del svg', /<svg[^>]*>[\s\S]*?<title id="diagram-title">/.test(html)],
  ['<desc> presente', html.includes('<desc id="diagram-desc">')],
  ['flechas antes que cajas', html.indexOf('ARROWS FIRST') < html.indexOf('NODES')],
  ['marker arrow', html.includes('marker id="arrow"')],
  ['cardinalidad 1', html.includes('>1<') || html.includes('>1</text>')],
  ['cardinalidad N', html.includes('>N</text>')],
  ['label REGISTRA', html.includes('REGISTRA')],
  ['label COMPONE', html.includes('COMPONE')],
  ['label TIENE', html.includes('TIENE')],
  ['entidad Users', html.includes('Users')],
  ['entidad Pregnancies', html.includes('Pregnancies')],
  ['campo PK #', html.includes('# id')],
  ['campo FK →', html.includes('→ user_id')],
  ['leyenda LEGEND', html.includes('LEGEND')],
  ['Google Fonts', html.includes('fonts.googleapis.com')],
  ['Geist Mono', html.includes('Geist Mono')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${name}`);
}

console.log(`\n${checks.length - failed}/${checks.length} checks OK (${html.length} bytes)`);
process.exit(failed > 0 ? 1 : 0);
