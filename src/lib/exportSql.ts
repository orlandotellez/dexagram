import { type Diagram, type Entity, type Relation } from './model';

const TYPE_MAP: Record<string, string> = {
  String: 'TEXT',
  Int: 'INTEGER',
  Float: 'DOUBLE PRECISION',
  Boolean: 'BOOLEAN',
  DateTime: 'TIMESTAMP(3)',
  Decimal: 'NUMERIC',
  Json: 'JSONB',
  BigInt: 'BIGINT',
  Bytes: 'BYTEA',
};

function toPascal(name: string): string {
  return name.replace(/(^|[_-])(\w)/g, (_, __, c: string) => c.toUpperCase());
}

function inferType(field: { name: string; type?: string }): string {
  if (field.type) return field.type;
  if (field.name === 'id') return 'Int';
  if (field.name.endsWith('_id')) return 'Int';
  if (field.name.endsWith('_at')) return 'DateTime';
  if (field.name.startsWith('is_')) return 'Boolean';
  return 'String';
}

function pkField(entity: Entity | undefined): { name: string } | undefined {
  return entity?.fields.find((f) => f.isPk);
}

export function exportSql(diagram: Diagram): string {
  const { entities, relations } = diagram;
  const lines: string[] = [];

  // Relations grouped by the entity that holds the FK (the target/child)
  const relsByTarget = new Map<string, Relation[]>();
  for (const rel of relations) {
    if (!relsByTarget.has(rel.target)) relsByTarget.set(rel.target, []);
    relsByTarget.get(rel.target)!.push(rel);
  }

  for (const entity of entities) {
    if (entity.fields.length === 0) continue;

    const tableName = entity.table;
    lines.push(`CREATE TABLE "${tableName}" (`);

    const fieldLines: string[] = [];
    for (const field of entity.fields) {
      const sqlType = TYPE_MAP[inferType(field)] ?? 'TEXT';
      let decl = `  "${field.name}" ${sqlType}`;
      decl += ' NOT NULL'; // nullability is not modelled on Field, so every field is required
      if (field.isPk) decl += ' DEFAULT uuid_generate_v4()';
      fieldLines.push(decl);
    }

    const pk = pkField(entity);
    if (pk) {
      fieldLines.push(`  CONSTRAINT "${tableName}_pkey" PRIMARY KEY ("${pk.name}")`);
    }

    lines.push(fieldLines.join(',\n'));
    lines.push(`);`);

    // Foreign keys: this entity holds the FK of the relations where it is the target
    for (const rel of relsByTarget.get(entity.id) ?? []) {
      const sourceEntity = entities.find((e) => e.id === rel.source);
      const fkField = entity.fields.find((f) => f.id === rel.targetFieldId);
      if (!sourceEntity || !fkField) continue;
      const srcPk = pkField(sourceEntity);
      if (!srcPk) continue;
      const fkName = `fk_${tableName}_${fkField.name}`;
      lines.push(
        `ALTER TABLE ONLY "${tableName}" ADD CONSTRAINT "${fkName}" FOREIGN KEY ("${fkField.name}") REFERENCES "${sourceEntity.table}"("${srcPk.name}");`
      );
    }

    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}