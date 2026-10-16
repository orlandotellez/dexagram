import { type Entity, type Field, type Relation, uid } from './model';

export interface DbmlParseResult {
  entities: Entity[];
  relations: Relation[];
}

interface RefSide {
  table: string;
  field: string;
}

interface PendingRef {
  left: RefSide;
  op: string;
  right: RefSide;
  label: string;
}

interface Chunk {
  header: string;
  body: string;
}

interface TableName {
  name: string;
  schema?: string;
  alias?: string;
}

interface BodyItem {
  kind: 'field' | 'inject';
  text: string;
}

interface PartialDef {
  name: string;
  schema?: string;
  body: string;
  key: string;
}

interface TableDef {
  entity: Entity;
  fullName: string;
  items: BodyItem[];
  indexes: string;
}

/** Maximum number of nested `~partial` expansions before a branch stops. */
const MAX_PARTIAL_DEPTH = 8;

const REF_OPS = ['>', '<', '-', '<>'];

/** Removes `//` and `/* ... *\/` comments while respecting quoted strings. */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;

  while (i < source.length) {
    const ch = source[i];

    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < source.length) {
        out += source[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      out += ' ';
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Reads a `{ ... }` block starting at `openIdx`; returns its body and end offset. */
function readBalanced(source: string, openIdx: number): { body: string; end: number } {
  let depth = 1;
  let i = openIdx + 1;
  let quote: string | null = null;

  while (i < source.length) {
    const ch = source[i];

    if (quote) {
      if (ch === '\\' && quote !== '`') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      i += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { body: source.slice(openIdx + 1, i), end: i + 1 };
      i += 1;
      continue;
    }

    i += 1;
  }

  return { body: source.slice(openIdx + 1), end: source.length };
}

/** Splits the source into top-level blocks and statements, keeping braces balanced. */
function splitTopLevel(source: string): Chunk[] {
  const chunks: Chunk[] = [];
  let buf = '';
  let i = 0;
  let quote: string | null = null;

  while (i < source.length) {
    const ch = source[i];

    if (quote) {
      buf += ch;
      if (ch === '\\' && quote !== '`' && i + 1 < source.length) {
        buf += source[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      buf += ch;
      i += 1;
      continue;
    }

    if (ch === '{') {
      const block = readBalanced(source, i);
      chunks.push({ header: buf.trim(), body: block.body });
      buf = '';
      i = block.end;
      continue;
    }

    if (ch === '}') {
      i += 1;
      continue;
    }

    if (ch === '\n' || ch === ';') {
      const statement = buf.trim();
      if (statement) chunks.push({ header: statement, body: '' });
      buf = '';
      i += 1;
      continue;
    }

    buf += ch;
    i += 1;
  }

  const tail = buf.trim();
  if (tail) chunks.push({ header: tail, body: '' });

  return chunks;
}

/** Splits a table body into field statements, skipping nested `{ ... }` blocks. */
function extractStatements(body: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let brace = 0;
  let square = 0;
  let quote: string | null = null;

  const flush = () => {
    const statement = buf.trim();
    if (statement) statements.push(statement);
    buf = '';
  };

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];

    if (quote) {
      buf += ch;
      if (ch === '\\' && quote !== '`' && i + 1 < body.length) {
        buf += body[i + 1];
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      buf += ch;
      continue;
    }

    if (ch === '{') {
      brace += 1;
      buf += ch;
      continue;
    }

    if (ch === '}') {
      if (brace > 0) brace -= 1;
      buf += ch;
      continue;
    }

    if (ch === '[') {
      square += 1;
      buf += ch;
      continue;
    }

    if (ch === ']') {
      if (square > 0) square -= 1;
      buf += ch;
      continue;
    }

    if ((ch === '\n' || ch === ';') && brace === 0 && square === 0) {
      flush();
      continue;
    }

    buf += ch;
  }

  flush();

  // Fold orphan attribute lines back into the previous field statement.
  const merged: string[] = [];
  for (const statement of statements) {
    if (statement.startsWith('[') && merged.length > 0) {
      merged[merged.length - 1] += ` ${statement}`;
      continue;
    }
    merged.push(statement);
  }

  return merged;
}

/** Finds the first `{` in a statement, ignoring braces inside quotes/backticks. */
function findTopLevelBrace(raw: string): number {
  let quote: string | null = null;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      if (ch === '\\' && quote !== '`') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') return i;
  }

  return -1;
}

/**
 * Returns the header of a nested `Name { ... }` block statement, or null when
 * the `{` belongs to an attribute value (e.g. `[default: '{}']`).
 */
function blockHeaderOf(statement: string): string | null {
  const brace = findTopLevelBrace(statement);
  if (brace === -1) return null;

  const attrStart = findAttributeStart(statement);
  if (attrStart !== -1 && attrStart < brace) return null;

  return statement.slice(0, brace).trim();
}

/** Returns the inner body of a balanced `Name { ... }` block statement. */
function extractBlockBody(statement: string): string {
  const brace = findTopLevelBrace(statement);
  if (brace === -1) return '';
  return readBalanced(statement, brace).body;
}

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }
  return value;
}

/** Splits a potentially qualified identifier by dots, respecting quotes. */
function splitDots(raw: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quote = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '"') {
      quote = !quote;
      cur += ch;
      continue;
    }
    if (ch === '.' && !quote) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }

  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function tokenizeHeader(raw: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: string | null = null;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (quote) {
      cur += ch;
      if (ch === '\\' && i + 1 < raw.length) {
        cur += raw[i + 1];
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (cur) {
        tokens.push(cur);
        cur = '';
      }
      continue;
    }

    cur += ch;
  }

  if (cur) tokens.push(cur);
  return tokens;
}

function parseTableHeader(rest: string): TableName | null {
  const tokens = tokenizeHeader(rest);
  if (tokens.length === 0) return null;

  const nameParts = splitDots(tokens[0]).map(unquote).filter((p) => p.length > 0);
  if (nameParts.length === 0) return null;

  const name = nameParts[nameParts.length - 1];
  if (!name) return null;

  const schema = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : undefined;
  let alias: string | undefined;
  if (tokens.length >= 3 && tokens[1].toLowerCase() === 'as') {
    alias = unquote(tokens[2]);
  }

  return { name, schema, alias };
}

function parseRefSide(raw: string): RefSide | null {
  const side = raw.trim();
  if (!side) return null;

  const parenIdx = side.indexOf('(');
  if (parenIdx !== -1) {
    const closeIdx = side.indexOf(')', parenIdx);
    if (closeIdx === -1) return null;
    const before = side.slice(0, parenIdx).replace(/\.\s*$/, '').trim();
    const inner = side.slice(parenIdx + 1, closeIdx);
    const firstField = inner.split(',')[0].trim();
    const tableParts = splitDots(before).map(unquote);
    if (tableParts.length === 0 || !firstField) return null;
    const table = tableParts.join('.');
    const field = unquote(firstField);
    if (!table || !field) return null;
    return { table, field };
  }

  const parts = splitDots(side);
  if (parts.length < 2) return null;

  const field = unquote(parts[parts.length - 1]);
  const table = parts.slice(0, -1).map(unquote).join('.');
  if (!table || !field) return null;
  return { table, field };
}

/** Matches a relation operator, ignoring an optional `?` marker on either side. */
function matchOperator(text: string, start: number): { op: string; next: number } | null {
  let j = start;
  if (text[j] === '?') j += 1;

  let op: string | null = null;
  if (text[j] === '<' && text[j + 1] === '>') {
    op = '<>';
    j += 2;
  } else if (text[j] === '<' || text[j] === '>' || text[j] === '-') {
    op = text[j];
    j += 1;
  }

  if (!op) return null;
  if (text[j] === '?') j += 1;

  return { op, next: j };
}

function tokenizeRefText(text: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote = false;
  let depth = 0;

  const flush = () => {
    const token = cur.trim();
    if (token) tokens.push(token);
    cur = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      cur += ch;
      if (ch === '\\' && i + 1 < text.length) {
        cur += text[i + 1];
        i += 1;
        continue;
      }
      if (ch === '"') quote = false;
      continue;
    }

    if (ch === '"') {
      quote = true;
      cur += ch;
      continue;
    }

    if (ch === '(') {
      depth += 1;
      cur += ch;
      continue;
    }

    if (ch === ')') {
      if (depth > 0) depth -= 1;
      cur += ch;
      continue;
    }

    if (depth === 0) {
      if (/\s/.test(ch)) {
        flush();
        continue;
      }
      const operator = matchOperator(text, i);
      if (operator) {
        flush();
        tokens.push(operator.op);
        i = operator.next - 1;
        continue;
      }
    }

    cur += ch;
  }

  flush();
  return tokens;
}

function parseRefStatements(text: string): Array<{ left: string; op: string; right: string }> {
  const tokens = tokenizeRefText(text);
  const statements: Array<{ left: string; op: string; right: string }> = [];

  let i = 0;
  while (i + 2 < tokens.length) {
    const op = tokens[i + 1];
    if (REF_OPS.includes(op)) {
      statements.push({ left: tokens[i], op, right: tokens[i + 2] });
      i += 3;
      continue;
    }
    i += 1;
  }

  return statements;
}

function findTopLevelColon(raw: string): number {
  let quote = false;
  let depth = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      if (ch === '"') quote = false;
      continue;
    }
    if (ch === '"') {
      quote = true;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      if (depth > 0) depth -= 1;
    } else if (ch === ':' && depth === 0) {
      return i;
    }
  }
  return -1;
}

function findAttributeStart(raw: string): number {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '[' && (i === 0 || /\s/.test(raw[i - 1]))) return i;
  }
  return -1;
}

function extractBracketGroups(raw: string): string[] {
  const groups: string[] = [];
  let i = 0;

  while (i < raw.length) {
    if (raw[i] !== '[') {
      i += 1;
      continue;
    }

    let j = i + 1;
    let quote: string | null = null;
    let buf = '';
    while (j < raw.length) {
      const ch = raw[j];
      if (quote) {
        if (ch === '\\') {
          buf += ch + (raw[j + 1] ?? '');
          j += 2;
          continue;
        }
        if (ch === quote) quote = null;
        buf += ch;
        j += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        buf += ch;
        j += 1;
        continue;
      }
      if (ch === ']') break;
      buf += ch;
      j += 1;
    }

    groups.push(buf);
    i = j + 1;
  }

  return groups;
}

function splitTopLevelCommas(raw: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let depth = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (quote) {
      cur += ch;
      if (ch === '\\') {
        cur += raw[i + 1] ?? '';
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }

    if (ch === '(') depth += 1;
    else if (ch === ')' && depth > 0) depth -= 1;

    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }

    cur += ch;
  }

  parts.push(cur);
  return parts;
}

function lookupField(entity: Entity, name: string): Field | undefined {
  if (!name) return undefined;
  const exact = entity.fields.find((f) => f.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return entity.fields.find((f) => f.name.toLowerCase() === lower);
}

function lookupTable(
  name: string,
  byName: Map<string, Entity>,
  byAlias: Map<string, Entity>,
): Entity | undefined {
  if (!name) return undefined;

  const exact = byName.get(name);
  if (exact) return exact;

  const lower = name.toLowerCase();
  for (const [key, entity] of byName) {
    if (key.toLowerCase() === lower) return entity;
  }

  const alias = byAlias.get(name);
  if (alias) return alias;

  for (const [key, entity] of byAlias) {
    if (key.toLowerCase() === lower) return entity;
  }

  return undefined;
}

function parseField(
  statement: string,
  entity: Entity,
  leftTable: string,
  pending: PendingRef[],
): void {
  const match = /^(?:"([^"]*)"|([A-Za-z_][\w$]*))\s+([\s\S]*)$/.exec(statement);
  if (!match) return;

  const fieldName = match[1] ?? match[2];
  if (!fieldName) return;

  const rest = match[3];
  const attrStart = findAttributeStart(rest);
  const type = (attrStart === -1 ? rest : rest.slice(0, attrStart)).trim();

  const field: Field = {
    id: uid(),
    name: fieldName,
    isPk: false,
    isFk: false,
    type: type || undefined,
  };
  entity.fields.push(field);

  if (attrStart === -1) return;

  const groups = extractBracketGroups(rest.slice(attrStart));
  for (const group of groups) {
    for (const rawAttr of splitTopLevelCommas(group)) {
      const attr = rawAttr.trim();
      if (!attr) continue;

      if (/^(pk|primary\s+key)$/i.test(attr)) {
        field.isPk = true;
        continue;
      }

      const refMatch = /^ref\s*:\s*([\s\S]+)$/i.exec(attr);
      if (!refMatch) continue;

      const expr = refMatch[1].trim();
      const operator = matchOperator(expr, 0);
      if (!operator) continue;

      const right = parseRefSide(expr.slice(operator.next));
      if (!right) continue;

      pending.push({
        left: { table: leftTable, field: fieldName },
        op: operator.op,
        right,
        label: '',
      });
    }
  }
}

function parseTableChunk(
  chunk: Chunk,
  entities: Entity[],
  byName: Map<string, Entity>,
  byAlias: Map<string, Entity>,
): TableDef | null {
  const headerRest = chunk.header.replace(/^Table\b/i, '').trim();
  const parsed = parseTableHeader(headerRest);
  if (!parsed) return null;

  const fullName = parsed.schema ? `${parsed.schema}.${parsed.name}` : parsed.name;
  const entity: Entity = {
    id: uid(),
    name: parsed.name,
    table: parsed.name,
    x: (entities.length % 4) * 280,
    y: Math.floor(entities.length / 4) * 200,
    fields: [],
  };

  // A schema-less table also answers to `public.<name>`, but a schema-qualified
  // table is only reachable through its qualified name (DBML semantics).
  if (parsed.schema) {
    byName.set(fullName, entity);
  } else {
    byName.set(parsed.name, entity);
    byName.set(`public.${parsed.name}`, entity);
  }
  if (parsed.alias) byAlias.set(parsed.alias, entity);

  entities.push(entity);

  const items: BodyItem[] = [];
  let indexes = '';

  for (const statement of extractStatements(chunk.body)) {
    const blockHeader = blockHeaderOf(statement);
    if (blockHeader !== null) {
      if (/^indexes$/i.test(blockHeader)) indexes = extractBlockBody(statement);
      continue;
    }

    if (statement.startsWith('~')) {
      const name = statement.slice(1).trim();
      if (name) items.push({ kind: 'inject', text: name });
      continue;
    }

    items.push({ kind: 'field', text: statement });
  }

  return { entity, fullName, items, indexes };
}

function collectPartial(chunk: Chunk, partials: Map<string, PartialDef>): void {
  const headerRest = chunk.header.replace(/^TablePartial\b/i, '').trim();
  const parsed = parseTableHeader(headerRest);
  if (!parsed) return;

  const key = parsed.schema ? `${parsed.schema}.${parsed.name}` : parsed.name;
  const def: PartialDef = { name: parsed.name, schema: parsed.schema, body: chunk.body, key };
  partials.set(key, def);
  partials.set(parsed.name, def);
}

function lookupPartial(name: string, partials: Map<string, PartialDef>): PartialDef | undefined {
  const exact = partials.get(name);
  if (exact) return exact;

  const lower = name.toLowerCase();
  for (const [key, partial] of partials) {
    if (key.toLowerCase() === lower) return partial;
  }

  return undefined;
}

function toBodyItems(statements: string[]): BodyItem[] {
  const items: BodyItem[] = [];

  for (const statement of statements) {
    if (blockHeaderOf(statement) !== null) continue;

    if (statement.startsWith('~')) {
      const name = statement.slice(1).trim();
      if (name) items.push({ kind: 'inject', text: name });
      continue;
    }

    items.push({ kind: 'field', text: statement });
  }

  return items;
}

/** Materializes an entity's fields, expanding `~partial` injections in place. */
function materializeFields(
  def: TableDef,
  partials: Map<string, PartialDef>,
  pending: PendingRef[],
): void {
  const visit = (items: BodyItem[], depth: number, stack: Set<string>): void => {
    for (const item of items) {
      if (item.kind === 'field') {
        parseField(item.text, def.entity, def.fullName, pending);
        continue;
      }

      if (depth >= MAX_PARTIAL_DEPTH) continue;
      const partial = lookupPartial(item.text, partials);
      if (!partial || stack.has(partial.key)) continue;

      const nextStack = new Set(stack);
      nextStack.add(partial.key);
      visit(toBodyItems(extractStatements(partial.body)), depth + 1, nextStack);
    }
  };

  visit(def.items, 0, new Set());
}

/** Marks `isPk` on every existing field listed by a `[pk]` entry in Indexes. */
function applyIndexesPk(entity: Entity, body: string): void {
  if (!body) return;

  for (const entry of extractStatements(body)) {
    const attrStart = findAttributeStart(entry);
    if (attrStart === -1) continue;

    const groups = extractBracketGroups(entry.slice(attrStart));
    const isPk = groups.some((group) =>
      splitTopLevelCommas(group).some((attr) => /^(pk|primary\s+key)$/i.test(attr.trim())),
    );
    if (!isPk) continue;

    const target = entry.slice(0, attrStart).trim();
    const names = target.startsWith('(')
      ? target.replace(/^\(/, '').replace(/\)$/, '').split(',')
      : [target];

    for (const rawName of names) {
      const name = unquote(rawName);
      if (!name) continue;
      const field = lookupField(entity, name);
      if (field) field.isPk = true;
    }
  }
}

function parseRefChunk(chunk: Chunk, pending: PendingRef[]): void {
  const afterRef = chunk.header.replace(/^Ref\b/i, '').trimStart();
  const body = chunk.body.trim();

  let label = '';
  let statementText: string;

  if (body) {
    label = afterRef.replace(/^:/, '').trim();
    statementText = body;
  } else {
    const colon = findTopLevelColon(afterRef);
    if (colon === -1) {
      statementText = afterRef.trim();
    } else {
      label = afterRef.slice(0, colon).trim();
      statementText = afterRef.slice(colon + 1).trim();
    }
  }

  for (const statement of parseRefStatements(statementText)) {
    const left = parseRefSide(statement.left);
    const right = parseRefSide(statement.right);
    if (!left || !right) continue;
    pending.push({ left, op: statement.op, right, label });
  }
}

function resolveRelations(
  pending: PendingRef[],
  byName: Map<string, Entity>,
  byAlias: Map<string, Entity>,
): Relation[] {
  const relations: Relation[] = [];

  for (const ref of pending) {
    const leftEntity = lookupTable(ref.left.table, byName, byAlias);
    const rightEntity = lookupTable(ref.right.table, byName, byAlias);
    if (!leftEntity || !rightEntity) continue;

    let source: Entity;
    let target: Entity;
    let sourceCard: string;
    let targetCard: string;
    let sourceField: Field | undefined;
    let targetField: Field | undefined;

    if (ref.op === '>') {
      source = rightEntity;
      target = leftEntity;
      sourceCard = '1';
      targetCard = 'N';
      sourceField = lookupField(rightEntity, ref.right.field);
      targetField = lookupField(leftEntity, ref.left.field);
    } else if (ref.op === '<') {
      source = leftEntity;
      target = rightEntity;
      sourceCard = '1';
      targetCard = 'N';
      sourceField = lookupField(leftEntity, ref.left.field);
      targetField = lookupField(rightEntity, ref.right.field);
    } else if (ref.op === '-') {
      source = leftEntity;
      target = rightEntity;
      sourceCard = '1';
      targetCard = '1';
      sourceField = lookupField(leftEntity, ref.left.field);
      targetField = lookupField(rightEntity, ref.right.field);
    } else if (ref.op === '<>') {
      source = leftEntity;
      target = rightEntity;
      sourceCard = 'N';
      targetCard = 'N';
    } else {
      continue;
    }

    if (ref.op !== '<>') {
      if (!sourceField || !targetField) continue;
      targetField.isFk = true;
    }

    relations.push({
      id: uid(),
      source: source.id,
      target: target.id,
      sourceCard,
      targetCard,
      label: ref.label,
      sourceFieldId: sourceField?.id,
      targetFieldId: targetField?.id,
    });
  }

  return relations;
}

/**
 * Parses DBML into Dexagram entities and relations. Never throws: unknown or
 * malformed input yields whatever could be parsed, possibly empty arrays.
 */
export function parseDbml(source: string): DbmlParseResult {
  const entities: Entity[] = [];
  const pending: PendingRef[] = [];
  const byName = new Map<string, Entity>();
  const byAlias = new Map<string, Entity>();

  try {
    const cleaned = stripComments(source ?? '');
    const chunks = splitTopLevel(cleaned);

    const partials = new Map<string, PartialDef>();
    const tables: TableDef[] = [];
    const refChunks: Chunk[] = [];

    for (const chunk of chunks) {
      if (/^TablePartial\b/i.test(chunk.header)) {
        collectPartial(chunk, partials);
      } else if (/^Table\b/i.test(chunk.header)) {
        const def = parseTableChunk(chunk, entities, byName, byAlias);
        if (def) tables.push(def);
      } else if (/^Ref\b/i.test(chunk.header)) {
        refChunks.push(chunk);
      }
    }

    // Order matters: parse tables -> inject partials -> apply Indexes PKs -> resolve refs.
    for (const def of tables) {
      materializeFields(def, partials, pending);
      applyIndexesPk(def.entity, def.indexes);
    }

    for (const chunk of refChunks) parseRefChunk(chunk, pending);

    return { entities, relations: resolveRelations(pending, byName, byAlias) };
  } catch {
    return { entities, relations: [] };
  }
}
