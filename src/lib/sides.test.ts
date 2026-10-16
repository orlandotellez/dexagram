import { describe, test, expect } from 'bun:test';
import { type Entity, type Relation, fieldHandleId } from './model';
import {
  autoSide,
  concreteSide,
  effectiveSide,
  flipRelationSides,
  oppositeSide,
  sideHandle,
  sideOfHandle,
} from './sides';

function entity(id: string, x: number): Entity {
  return { id, name: id, table: id, x, y: 0, fields: [] };
}

function relation(patch: Partial<Relation> = {}): Relation {
  return {
    id: 'r1',
    source: 'a',
    target: 'b',
    sourceCard: '1',
    targetCard: 'N',
    label: '',
    ...patch,
  };
}

describe('oppositeSide', () => {
  test('flips L <-> R', () => {
    expect(oppositeSide('L')).toBe('R');
    expect(oppositeSide('R')).toBe('L');
  });
});

describe('sideOfHandle', () => {
  test('reads the four entity-level handles', () => {
    expect(sideOfHandle('sl')).toBe('L');
    expect(sideOfHandle('tl')).toBe('L');
    expect(sideOfHandle('sr')).toBe('R');
    expect(sideOfHandle('tr')).toBe('R');
  });

  test('reads field handles', () => {
    expect(sideOfHandle('f:fld-1:L:src')).toBe('L');
    expect(sideOfHandle('f:fld-1:R:tgt')).toBe('R');
  });

  test('returns undefined for null or garbage', () => {
    expect(sideOfHandle(null)).toBeUndefined();
    expect(sideOfHandle(undefined)).toBeUndefined();
    expect(sideOfHandle('')).toBeUndefined();
    expect(sideOfHandle('nope')).toBeUndefined();
  });
});

describe('autoSide', () => {
  test('source left of target -> R / L', () => {
    const byId = new Map([['a', entity('a', 100)], ['b', entity('b', 400)]]);
    expect(autoSide(relation(), byId)).toEqual({ sourceSide: 'R', targetSide: 'L' });
  });

  test('source right of target -> L / R', () => {
    const byId = new Map([['a', entity('a', 500)], ['b', entity('b', 100)]]);
    expect(autoSide(relation(), byId)).toEqual({ sourceSide: 'L', targetSide: 'R' });
  });

  test('missing entity -> {}', () => {
    expect(autoSide(relation(), new Map())).toEqual({});
    expect(autoSide(relation())).toEqual({});
  });
});

describe('sideHandle geometry (regression guard for the missing byId)', () => {
  // source x=500 is to the RIGHT of target x=100, no pinned sides.
  const byId = new Map([['a', entity('a', 500)], ['b', entity('b', 100)]]);
  const rel = relation();

  test('with byId geometry decides the handle', () => {
    expect(sideHandle(rel, 'source', byId)).toBe('sl');
    expect(sideHandle(rel, 'target', byId)).toBe('tr');
  });

  test('without byId an entity-level relation has no handle', () => {
    // Sin byId no hay geometría y la relación no está pinneada, así que
    // `sideHandle` devuelve undefined y React Flow cae a su propio handle por
    // defecto en vez de respetar la orientación automática. Por eso TODO call
    // site dentro del canvas debe pasar el mapa byId.
    expect(sideHandle(rel, 'source')).toBeUndefined();
    expect(sideHandle(rel, 'target')).toBeUndefined();
  });
});

describe('sideHandle for field-pinned relations', () => {
  const byId = new Map([['a', entity('a', 100)], ['b', entity('b', 400)]]);

  test('uses the automatic side when byId is provided', () => {
    const rel = relation({ sourceFieldId: 'fsrc', targetFieldId: 'ftgt' });
    // source left of target -> auto R / L
    expect(sideHandle(rel, 'source', byId)).toBe(fieldHandleId('fsrc', 'R', 'src'));
    expect(sideHandle(rel, 'target', byId)).toBe(fieldHandleId('ftgt', 'L', 'tgt'));
  });

  test('a pinned side wins over geometry', () => {
    const rel = relation({ sourceFieldId: 'fsrc', targetFieldId: 'ftgt', sourceSide: 'L', targetSide: 'R' });
    expect(sideHandle(rel, 'source', byId)).toBe(fieldHandleId('fsrc', 'L', 'src'));
    expect(sideHandle(rel, 'target', byId)).toBe(fieldHandleId('ftgt', 'R', 'tgt'));
  });

  test('without byId it falls back to the concrete R / L defaults', () => {
    // El default concreto (R para el origen, L para el destino) es justamente
    // el bug que activa este feature cuando se edita sin pasar byId.
    const rel = relation({ sourceFieldId: 'fsrc', targetFieldId: 'ftgt' });
    expect(sideHandle(rel, 'source')).toBe(fieldHandleId('fsrc', 'R', 'src'));
    expect(sideHandle(rel, 'target')).toBe(fieldHandleId('ftgt', 'L', 'tgt'));
  });
});

describe('effectiveSide / concreteSide', () => {
  test('entity-level relation with no side and no byId', () => {
    const rel = relation();
    expect(effectiveSide(rel, 'source')).toBeUndefined();
    expect(effectiveSide(rel, 'target')).toBeUndefined();
    expect(concreteSide(rel, 'source')).toBe('R');
    expect(concreteSide(rel, 'target')).toBe('L');
  });

  test('a pinned side wins, an absent one falls back to geometry', () => {
    const byId = new Map([['a', entity('a', 100)], ['b', entity('b', 400)]]);
    const rel = relation({ sourceSide: 'L' });
    expect(effectiveSide(rel, 'source', byId)).toBe('L');
    expect(effectiveSide(rel, 'target', byId)).toBe('L');
  });
});

describe('flipRelationSides', () => {
  const byId = new Map([['a', entity('a', 100)], ['b', entity('b', 400)]]);

  test('pins both sides to the opposite of the geometric ones', () => {
    const flipped = flipRelationSides(relation(), byId);
    // source left of target -> auto R / L -> pinned L / R
    expect(flipped.sourceSide).toBe('L');
    expect(flipped.targetSide).toBe('R');
  });

  test('is idempotent in its effective sides', () => {
    const rel = relation();
    const beforeSource = effectiveSide(rel, 'source', byId);
    const beforeTarget = effectiveSide(rel, 'target', byId);
    const twice = flipRelationSides(flipRelationSides(rel, byId), byId);
    expect(effectiveSide(twice, 'source', byId)).toBe(beforeSource);
    expect(effectiveSide(twice, 'target', byId)).toBe(beforeTarget);
  });

  test('preserves id, endpoints, cards, label and field pins', () => {
    const rel = relation({
      sourceFieldId: 'fsrc',
      targetFieldId: 'ftgt',
      sourceCard: '0',
      targetCard: '1',
      label: 'TIENE',
    });
    const flipped = flipRelationSides(rel, byId);
    expect(flipped.id).toBe('r1');
    expect(flipped.source).toBe('a');
    expect(flipped.target).toBe('b');
    expect(flipped.sourceCard).toBe('0');
    expect(flipped.targetCard).toBe('1');
    expect(flipped.label).toBe('TIENE');
    expect(flipped.sourceFieldId).toBe('fsrc');
    expect(flipped.targetFieldId).toBe('ftgt');
  });
});
