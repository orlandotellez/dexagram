import { type Diagram, type Entity, type Relation } from './model';

function toPascal(name: string): string {
  return name.replace(/(^|[_-])(\w)/g, (_, __, c: string) => c.toUpperCase());
}

function toCamel(name: string): string {
  const pascal = toPascal(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** Pluralizes a model name into a Prisma list-field name. */
function toPluralField(name: string): string {
  const camel = toCamel(name);
  if (camel.endsWith('s')) return camel; // already plural
  if (/[sxz]$/.test(camel) || /(ch|sh)$/.test(camel)) return `${camel}es`;
  if (/[bcdfghjklmnpqrstvwxz]y$/.test(camel)) return `${camel.slice(0, -1)}ies`;
  return `${camel}s`;
}

function inferType(field: { name: string; type?: string }): string {
  if (field.type) return field.type;
  if (field.name === 'id') return 'Int';
  if (field.name.endsWith('_id')) return 'Int';
  if (field.name.endsWith('_at')) return 'DateTime';
  if (field.name.startsWith('is_')) return 'Boolean';
  return 'String';
}

/** Returns the PK field of an entity, if any. */
function pkField(entity: Entity | undefined): { name: string } | undefined {
  return entity?.fields.find((f) => f.isPk);
}

export function exportPrisma(diagram: Diagram): string {
  const { entities, relations } = diagram;
  const lines: string[] = [];

  // Relations grouped by the entity on each side
  const relsByTarget = new Map<string, Relation[]>();
  const relsBySource = new Map<string, Relation[]>();
  for (const rel of relations) {
    if (!relsByTarget.has(rel.target)) relsByTarget.set(rel.target, []);
    relsByTarget.get(rel.target)!.push(rel);
    if (!relsBySource.has(rel.source)) relsBySource.set(rel.source, []);
    relsBySource.get(rel.source)!.push(rel);
  }

  for (const entity of entities) {
    if (entity.fields.length === 0) continue;

    const name = toPascal(entity.name);
    lines.push(`model ${name} {`);

    // Scalar fields
    for (const field of entity.fields) {
      const type = inferType(field);
      const suffix = field.isPk ? ' @id @default(uuid())' : '';
      lines.push(`  ${field.name} ${type}${suffix}`);
    }

    // FK side of each relation where this entity is the target (child)
    for (const rel of relsByTarget.get(entity.id) ?? []) {
      const sourceEntity = entities.find((e) => e.id === rel.source);
      const fkField = entity.fields.find((f) => f.id === rel.targetFieldId);
      if (!sourceEntity || !fkField) continue;
      const sourceName = toPascal(sourceEntity.name);
      const refName = pkField(sourceEntity)?.name ?? 'id';
      lines.push(`  ${sourceName} ${sourceName} @relation(fields: [${fkField.name}], references: [${refName}])`);
    }

    // Reverse list side of each relation where this entity is the source (parent)
    for (const rel of relsBySource.get(entity.id) ?? []) {
      const targetEntity = entities.find((e) => e.id === rel.target);
      if (!targetEntity) continue;
      lines.push(`  ${toPluralField(targetEntity.name)} ${toPascal(targetEntity.name)}[]`);
    }

    // @@map when the table name differs from the default (lowercase model)
    if (entity.table !== entity.name.toLowerCase()) {
      lines.push(`  @@map("${entity.table}")`);
    }

    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}