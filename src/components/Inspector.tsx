import type { Entity, Field, Relation, Side } from '../lib/model';
import { uid } from '../lib/model';





export type Selection =
  | { kind: 'entity'; id: string; entity: Entity }
  | { kind: 'relation'; id: string; relation: Relation }
  | null;

interface InspectorProps {
  selection: Selection;
  entities: Entity[];
  onUpdateEntity: (id: string, patch: Partial<Entity>) => void;
  onUpdateField: (entityId: string, fieldId: string, patch: Partial<Field>) => void;
  onAddField: (entityId: string) => void;
  onRemoveField: (entityId: string, fieldId: string) => void;
  onUpdateRelation: (id: string, patch: Partial<Relation>) => void;
  onDeleteRelation: (id: string) => void;
  onDeleteEntity: (id: string) => void;
}

function FieldRow({
  field,
  onUpdate,
  onRemove,
}: {
  field: Field;
  onUpdate: (patch: Partial<Field>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="insp-row">
      <button
        type="button"
        className={`flag-btn${field.isPk ? ' active' : ''}`}
        title="Clave primaria (#)"
        onClick={() => onUpdate({ isPk: !field.isPk })}
      >
        #
      </button>
      <button
        type="button"
        className={`flag-btn${field.isFk ? ' active' : ''}`}
        title="Clave foránea (→)"
        onClick={() => onUpdate({ isFk: !field.isFk })}
      >
        →
      </button>
      <input
        className="insp-input insp-input-flex"
        value={field.name}
        placeholder="campo"
        onChange={(e) => onUpdate({ name: e.target.value })}
      />
      <button type="button" className="icon-btn" title="Eliminar campo" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

function SideToggle({
  side,
  onChange,
}: {
  side: Side | undefined;
  onChange: (side: Side) => void;
}) {
  return (
    <div className="side-toggle">
      <button
        type="button"
        className={`side-btn${side === 'L' ? ' active' : ''}`}
        title="Anclar la línea a la izquierda de la entidad"
        onClick={() => onChange('L')}
      >
        ← Izq
      </button>
      <button
        type="button"
        className={`side-btn${side === 'R' ? ' active' : ''}`}
        title="Anclar la línea a la derecha de la entidad"
        onClick={() => onChange('R')}
      >
        Der →
      </button>
    </div>
  );
}

export function Inspector({
  selection,
  entities,
  onUpdateEntity,
  onUpdateField,
  onAddField,
  onRemoveField,
  onUpdateRelation,
  onDeleteRelation,
  onDeleteEntity,
}: InspectorProps) {
  if (!selection) {
    return (
      <aside className="inspector">
        <p className="inspector-empty">
          Selecciona una entidad o una relación para editarla.
        </p>
      </aside>
    );
  }

  if (selection.kind === 'entity') {
    const { id, entity } = selection;
    return (
      <aside className="inspector">
        <div className="insp-header">
          <span className="insp-eyebrow">ENTIDAD</span>
          <button type="button" className="icon-btn danger" title="Eliminar entidad" onClick={() => onDeleteEntity(id)}>
            🗑
          </button>
        </div>

        <label className="insp-label">
          Nombre
          <input
            className="insp-input"
            value={entity.name}
            placeholder="Users"
            onChange={(e) => onUpdateEntity(id, { name: e.target.value })}
          />
        </label>

        <label className="insp-label">
          Tabla
          <input
            className="insp-input"
            value={entity.table}
            placeholder="users"
            onChange={(e) => onUpdateEntity(id, { table: e.target.value })}
          />
        </label>

        <label className="insp-check">
          <input
            type="checkbox"
            checked={!!entity.focal}
            onChange={(e) => onUpdateEntity(id, { focal: e.target.checked })}
          />
          <span>Entidad focal (raíz del dominio)</span>
        </label>

        <div className="insp-subheader">
          <span>Campos</span>
          <button type="button" className="mini-btn" onClick={() => onAddField(id)}>
            + campo
          </button>
        </div>

        {entity.fields.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            onUpdate={(patch) => onUpdateField(id, f.id, patch)}
            onRemove={() => onRemoveField(id, f.id)}
          />
        ))}
      </aside>
    );
  }

  const { id, relation } = selection;
  const srcEntity = entities.find((e) => e.id === relation.source);
  const dstEntity = entities.find((e) => e.id === relation.target);

  return (
    <aside className="inspector">
      <div className="insp-header">
        <span className="insp-eyebrow">RELACIÓN</span>
        <button
          type="button"
          className="icon-btn danger"
          title="Eliminar relación"
          onClick={() => onDeleteRelation(id)}
        >
          🗑
        </button>
      </div>

      <div className="insp-row insp-row-cards">
        <label className="insp-label">
          Origen
          <input
            className="insp-input"
            value={relation.sourceCard}
            placeholder="1"
            onChange={(e) => onUpdateRelation(id, { sourceCard: e.target.value })}
          />
        </label>
        <label className="insp-label">
          Destino
          <input
            className="insp-input"
            value={relation.targetCard}
            placeholder="N"
            onChange={(e) => onUpdateRelation(id, { targetCard: e.target.value })}
          />
        </label>
      </div>

      <label className="insp-label">
        Label de relación
        <input
          className="insp-input"
          value={relation.label}
          placeholder="TIENE"
          onChange={(e) => onUpdateRelation(id, { label: e.target.value.toUpperCase() })}
        />
      </label>

      <div className="insp-subheader">
        <span>Conexión</span>
      </div>

      <label className="insp-label">
        Campo origen{srcEntity ? ` (${srcEntity.name})` : ''}
        <select
          className="insp-input"
          value={relation.sourceFieldId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onUpdateRelation(id, {
              sourceFieldId: v || undefined,
              sourceSide: v ? (relation.sourceSide ?? 'R') : relation.sourceSide,
            });
          }}
        >
          <option value="">— entidad completa —</option>
          {srcEntity?.fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.isPk ? '# ' : f.isFk ? '→ ' : ''}
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <label className="insp-label">
        Lado origen
        <SideToggle side={relation.sourceSide} onChange={(side) => onUpdateRelation(id, { sourceSide: side })} />
      </label>

      <label className="insp-label">
        Campo destino{dstEntity ? ` (${dstEntity.name})` : ''}
        <select
          className="insp-input"
          value={relation.targetFieldId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onUpdateRelation(id, {
              targetFieldId: v || undefined,
              targetSide: v ? (relation.targetSide ?? 'L') : relation.targetSide,
            });
          }}
        >
          <option value="">— entidad completa —</option>
          {dstEntity?.fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.isPk ? '# ' : f.isFk ? '→ ' : ''}
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <label className="insp-label">
        Lado destino
        <SideToggle side={relation.targetSide} onChange={(side) => onUpdateRelation(id, { targetSide: side })} />
      </label>
    </aside>
  );
}

export { uid };
