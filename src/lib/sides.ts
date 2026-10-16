import { type Entity, type Relation, type Side, fieldHandleId } from './model';

export function oppositeSide(side: Side): Side {
  return side === 'L' ? 'R' : 'L';
}

export function sideOfHandle(handleId: string | null | undefined): Side | undefined {
  if (!handleId) return undefined;
  const m = /^f:[^:]+:([LR]):/.exec(handleId);
  if (m) return m[1] as Side;
  if (handleId === 'sl' || handleId === 'tl') return 'L';
  if (handleId === 'sr' || handleId === 'tr') return 'R';
  return undefined;
}

/** Lado automático según la posición relativa de las entidades. */
export function autoSide(rel: Relation, byId?: Map<string, Entity>): { sourceSide?: Side; targetSide?: Side } {
  const src = byId?.get(rel.source);
  const dst = byId?.get(rel.target);
  if (!src || !dst) return {};
  return src.x <= dst.x ? { sourceSide: 'R', targetSide: 'L' } : { sourceSide: 'L', targetSide: 'R' };
}

/** Lado efectivo: el elegido a mano, o el geométrico si falta. Puede ser `undefined`. */
export function effectiveSide(rel: Relation, end: 'source' | 'target', byId?: Map<string, Entity>): Side | undefined {
  const auto = autoSide(rel, byId);
  if (end === 'source') return rel.sourceSide ?? auto.sourceSide;
  return rel.targetSide ?? auto.targetSide;
}

/** Lado concreto: nunca `undefined`; cae a los defaults `R`/`L`. */
export function concreteSide(rel: Relation, end: 'source' | 'target', byId?: Map<string, Entity>): Side {
  return effectiveSide(rel, end, byId) ?? (end === 'source' ? 'R' : 'L');
}

/** Handle id de React Flow para el extremo pedido. */
export function sideHandle(rel: Relation, end: 'source' | 'target', byId?: Map<string, Entity>): string | undefined {
  if (end === 'source') {
    if (rel.sourceFieldId) return fieldHandleId(rel.sourceFieldId, concreteSide(rel, 'source', byId), 'src');
    const side = effectiveSide(rel, 'source', byId);
    return side === 'L' ? 'sl' : side === 'R' ? 'sr' : undefined;
  }
  if (rel.targetFieldId) return fieldHandleId(rel.targetFieldId, concreteSide(rel, 'target', byId), 'tgt');
  const side = effectiveSide(rel, 'target', byId);
  return side === 'L' ? 'tl' : side === 'R' ? 'tr' : undefined;
}

/** Invierte ambos lados y los deja pinneados explícitamente. */
export function flipRelationSides(rel: Relation, byId?: Map<string, Entity>): Relation {
  return {
    ...rel,
    sourceSide: oppositeSide(concreteSide(rel, 'source', byId)),
    targetSide: oppositeSide(concreteSide(rel, 'target', byId)),
  };
}
