import { type Entity, type Relation, type Field, uid } from './model';

export interface PrismaParseResult {
  entities: Entity[];
  relations: Relation[];
}

const PK_DEFAULT_RE = /@default\((uuid\(\)|cuid\(\)|gen_random_uuid\(\))\)/;
const RELATION_RE = /@relation\s*\(\s*fields:\s*\[([^\]]+)\]\s*,\s*references:\s*\[([^\]]+)\]\)/;

interface PendingRelation {
  sourceName: string;      // referenced model name (type of the relation field)
  fkFieldName: string;     // scalar FK field name on the target entity
  refFieldName: string;    // referenced field name on the source entity
  targetEntityId: string;
}

export function parsePrisma(schema: string): PrismaParseResult {
  const lines = schema.split('\n');
  const entities: Entity[] = [];
  const pending: PendingRelation[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip generator, datasource and enum blocks (track brace depth)
    if (/^(generator|datasource|enum)\s+/.test(line)) {
      let depth = 0;
      let j = i;
      for (; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
        }
        if (depth === 0) break;
      }
      i = j + 1;
      continue;
    }

    // Model block
    const modelMatch = /^model\s+(\w+)\s*\{/.exec(line);
    if (modelMatch) {
      const modelName = modelMatch[1];
      const entityId = uid();
      const fields: Field[] = [];
      let tableName: string | undefined;
      i++;

      let braceDepth = 1;
      while (i < lines.length && braceDepth > 0) {
        const inner = lines[i].trim();
        braceDepth += (inner.match(/{/g)?.length ?? 0) - (inner.match(/}/g)?.length ?? 0);
        if (inner === '}') {
          i++;
          break;
        }
        if (braceDepth <= 0) {
          i++;
          break;
        }

        // @@map("tablename")
        const mapMatch = /^@@map\("([^"]+)"\)/.exec(inner);
        if (mapMatch) {
          tableName = mapMatch[1];
          i++;
          continue;
        }

        // Skip other @@ directives (like @@index, @@unique) and comments
        if (/^@@/.test(inner) || inner.startsWith('//') || !inner) {
          i++;
          continue;
        }

        // Field line: name Type[]? @attributes...
        const fieldMatch = /^(\w+)\s+(\w+)(\[\])?(\?)?/.exec(inner);
        if (!fieldMatch) {
          i++;
          continue;
        }
        const fieldName = fieldMatch[1];
        const typeName = fieldMatch[2];
        const isArray = fieldMatch[3] !== undefined;

        // Relation field: name ModelName @relation(fields: [fk], references: [id])
        if (/@relation\s*\(/.test(inner)) {
          const relMatch = RELATION_RE.exec(inner);
          if (relMatch) {
            pending.push({
              sourceName: typeName,
              fkFieldName: relMatch[1].trim(),
              refFieldName: relMatch[2].trim(),
              targetEntityId: entityId,
            });
          }
          i++;
          continue;
        }

        // Array fields on the parent side of a 1-N relation: ignored for now
        if (isArray) {
          i++;
          continue;
        }

        const isPk = /@id\b/.test(inner) || PK_DEFAULT_RE.test(inner);
        fields.push({
          id: uid(),
          name: fieldName,
          isPk,
          isFk: false,
          type: typeName,
        });

        i++;
      }

      entities.push({
        id: entityId,
        name: modelName,
        table: tableName ?? modelName.toLowerCase(),
        x: (entities.length % 4) * 280,
        y: Math.floor(entities.length / 4) * 200,
        fields,
      });
      continue;
    }

    i++;
  }

  // Resolve relations once every entity is known
  const relations: Relation[] = pending
    .map((p) => {
      const sourceEntity = entities.find((e) => e.name === p.sourceName);
      const targetEntity = entities.find((e) => e.id === p.targetEntityId);
      if (!sourceEntity || !targetEntity) return null;

      const sourceField = sourceEntity.fields.find((f) => f.name === p.refFieldName) ?? sourceEntity.fields.find((f) => f.isPk);
      const targetField = targetEntity.fields.find((f) => f.name === p.fkFieldName);
      if (!sourceField || !targetField) return null;

      targetField.isFk = true;

      const relation: Relation = {
        id: uid(),
        source: sourceEntity.id,
        target: targetEntity.id,
        sourceCard: '1',
        targetCard: 'N',
        label: '',
        sourceFieldId: sourceField.id,
        targetFieldId: targetField.id,
      };
      return relation;
    })
    .filter((r): r is Relation => r !== null);

  return { entities, relations };
}