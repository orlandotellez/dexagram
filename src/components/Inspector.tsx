import { useState, useCallback, useMemo } from 'react';
import type { Entity, Field, Relation, Diagram, Side } from '../lib/model';
import { uid } from '../lib/model';
import { concreteSide } from '../lib/sides';
import { readImportDrafts, saveImportDrafts, type ImportDrafts } from '../lib/storage';
import { exportPrisma } from '../lib/exportPrisma';
import { exportSql } from '../lib/exportSql';

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
  onFlipRelation?: (id: string) => void;
  onDeleteEntity: (id: string) => void;
  onImportPrisma?: (schema: string) => void;
  onImportDbml?: (dbml: string) => number;
  exportData?: Diagram | null;
}

function DbmlImport({
  onImport,
  value,
  onChange,
}: {
  onImport: (dbml: string) => number;
  value: string;
  onChange: (v: string) => void;
}) {
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const handleGenerate = () => {
    const dbml = value.trim();
    if (!dbml) return;
    const imported = onImport(dbml);
    // The parser never throws, so unparseable input arrives as zero entities.
    // The pasted source is kept in BOTH outcomes: a long schema has to stay
    // editable so it can be fixed and regenerated without re-pasting.
    if (imported === 0) {
      setResult('');
      setError('No se reconoció ninguna tabla en el DBML. Revisá el esquema.');
      return;
    }
    setError('');
    setResult(`${imported} tabla${imported === 1 ? '' : 's'} importada${imported === 1 ? '' : 's'}.`);
  };

  return (
    <div>
      <div className="insp-section-title">Importar DBML</div>
      <textarea
        className="insp-textarea"
        rows={6}
        value={value}
        placeholder="Pegá tu esquema DBML acá..."
        onChange={(e) => {
          onChange(e.target.value);
          if (error) setError('');
          if (result) setResult('');
        }}
      />
      {error ? (
        <p className="insp-hint insp-hint-error">{error}</p>
      ) : result ? (
        <p className="insp-hint insp-hint-ok">{result}</p>
      ) : (
        <p className="insp-hint">Reemplaza el diagrama actual.</p>
      )}
      <button
        type="button"
        className="mini-btn mini-btn-link"
        style={{ marginTop: 8 }}
        disabled={!value.trim()}
        onClick={handleGenerate}
      >
        Generar diagrama
      </button>
    </div>
  );
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
        title="Clave foranea (→)"
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

function SideSegmented({
  value,
  onChange,
}: {
  value: Side | undefined;
  onChange: (v: Side | undefined) => void;
}) {
  return (
    <div className="insp-seg" role="group">
      <button
        type="button"
        className={`insp-seg-btn${value === undefined ? ' active' : ''}`}
        aria-pressed={value === undefined}
        onClick={() => onChange(undefined)}
      >
        Auto
      </button>
      <button
        type="button"
        className={`insp-seg-btn${value === 'L' ? ' active' : ''}`}
        aria-pressed={value === 'L'}
        onClick={() => onChange('L')}
      >
        ◀ Izq
      </button>
      <button
        type="button"
        className={`insp-seg-btn${value === 'R' ? ' active' : ''}`}
        aria-pressed={value === 'R'}
        onClick={() => onChange('R')}
      >
        Der ▶
      </button>
    </div>
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
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
  onFlipRelation,
  onDeleteEntity,
  onImportPrisma,
  onImportDbml,
  exportData,
}: InspectorProps) {
  const [tab, setTab] = useState<'entity' | 'import-export'>('entity');
  // Both import panels (DBML and Prisma) share one persisted scratch buffer, so a
  // pasted schema survives leaving the Importar / Exportar tab and a page reload.
  const [drafts, setDrafts] = useState<ImportDrafts>(readImportDrafts);
  const updateDrafts = useCallback((patch: Partial<ImportDrafts>) => {
    setDrafts((prev) => {
      const next = { ...prev, ...patch };
      saveImportDrafts(next);
      return next;
    });
  }, []);

  const handleCopyPrisma = useCallback(async () => {
    if (!exportData) return;
    await copyToClipboard(exportPrisma(exportData));
  }, [exportData]);

  const handleCopySql = useCallback(async () => {
    if (!exportData) return;
    await copyToClipboard(exportSql(exportData));
  }, [exportData]);

  const handleImport = useCallback(() => {
    if (drafts.prisma.trim() && onImportPrisma) {
      onImportPrisma(drafts.prisma);
    }
  }, [drafts.prisma, onImportPrisma]);

  const prismaCode = useMemo(() => exportData ? exportPrisma(exportData) : '', [exportData]);
  const sqlCode = useMemo(() => exportData ? exportSql(exportData) : '', [exportData]);

  const isEntity = selection?.kind === 'entity';
  const isRelation = selection?.kind === 'relation';
  const entity = isEntity ? selection.entity : null;
  const entityId = isEntity ? selection.id : null;
  const relation = isRelation ? selection.relation : null;
  const relationId = isRelation ? selection.id : null;
  const srcEntity = relation ? entities.find((e) => e.id === relation.source) : null;
  const dstEntity = relation ? entities.find((e) => e.id === relation.target) : null;
  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  return (
    <aside className="inspector">
      <div className="insp-tabs">
        <button
          type="button"
          className={`insp-tab${tab === 'entity' ? ' insp-tab-active' : ''}`}
          onClick={() => setTab('entity')}
        >
          {isEntity ? 'Entidad' : isRelation ? 'Relacion' : 'Entidad'}
        </button>
        <button
          type="button"
          className={`insp-tab${tab === 'import-export' ? ' insp-tab-active' : ''}`}
          onClick={() => setTab('import-export')}
        >
          Importar / Exportar
        </button>
      </div>

      {tab === 'entity' && !selection && (
        <p className="inspector-empty">
          Seleccioná una entidad o una relación para editarla.
        </p>
      )}

      {tab === 'entity' && isEntity && entity && entityId && (
        <>
          <div className="insp-header">
            <span className="insp-eyebrow">ENTIDAD</span>
            <button type="button" className="icon-btn danger" title="Eliminar entidad" onClick={() => onDeleteEntity(entityId)}>
              🗑
            </button>
          </div>

          <label className="insp-label">
            Nombre
            <input
              className="insp-input"
              value={entity.name}
              placeholder="Users"
              onChange={(e) => onUpdateEntity(entityId, { name: e.target.value })}
            />
          </label>

          <label className="insp-label">
            Tabla
            <input
              className="insp-input"
              value={entity.table}
              placeholder="users"
              onChange={(e) => onUpdateEntity(entityId, { table: e.target.value })}
            />
          </label>

          <label className="insp-check">
            <input
              type="checkbox"
              checked={!!entity.focal}
              onChange={(e) => onUpdateEntity(entityId, { focal: e.target.checked })}
            />
            <span>Entidad focal (raiz del dominio)</span>
          </label>

          <div className="insp-subheader">
            <span>Campos</span>
            <button type="button" className="mini-btn" onClick={() => onAddField(entityId)}>
              + campo
            </button>
          </div>

          {entity.fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              onUpdate={(patch) => onUpdateField(entityId, f.id, patch)}
              onRemove={() => onRemoveField(entityId, f.id)}
            />
          ))}
        </>
      )}

      {tab === 'entity' && isRelation && relation && relationId && (
        <>
          <div className="insp-header">
            <span className="insp-eyebrow">RELACION</span>
            <button
              type="button"
              className="icon-btn danger"
              title="Eliminar relacion"
              onClick={() => onDeleteRelation(relationId)}
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
                onChange={(e) => onUpdateRelation(relationId, { sourceCard: e.target.value })}
              />
            </label>
            <label className="insp-label">
              Destino
              <input
                className="insp-input"
                value={relation.targetCard}
                placeholder="N"
                onChange={(e) => onUpdateRelation(relationId, { targetCard: e.target.value })}
              />
            </label>
          </div>

          <label className="insp-label">
            Label de relacion
            <input
              className="insp-input"
              value={relation.label}
              placeholder="TIENE"
              onChange={(e) => onUpdateRelation(relationId, { label: e.target.value.toUpperCase() })}
            />
          </label>

          <div className="insp-subheader">
            <span>Lados</span>
            {onFlipRelation && (
              <button type="button" className="mini-btn" onClick={() => onFlipRelation(relationId)}>
                ⇄ Invertir
              </button>
            )}
          </div>

          <div className="insp-label">
            Lado origen{srcEntity ? ` (${srcEntity.name})` : ''}
            <SideSegmented
              value={relation.sourceSide}
              onChange={(v) => onUpdateRelation(relationId, { sourceSide: v })}
            />
            {relation.sourceSide === undefined && (
              <span className="insp-hint">
                Auto · ahora {concreteSide(relation, 'source', byId) === 'L' ? 'Izquierda' : 'Derecha'}
              </span>
            )}
          </div>

          <div className="insp-label">
            Lado destino{dstEntity ? ` (${dstEntity.name})` : ''}
            <SideSegmented
              value={relation.targetSide}
              onChange={(v) => onUpdateRelation(relationId, { targetSide: v })}
            />
            {relation.targetSide === undefined && (
              <span className="insp-hint">
                Auto · ahora {concreteSide(relation, 'target', byId) === 'L' ? 'Izquierda' : 'Derecha'}
              </span>
            )}
          </div>

          <div className="insp-subheader">
            <span>Conexion</span>
          </div>

          <label className="insp-label">
            Campo origen{srcEntity ? ` (${srcEntity.name})` : ''}
            <select
              className="insp-input"
              value={relation.sourceFieldId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onUpdateRelation(relationId, {
                  sourceFieldId: v || undefined,
                });
              }}
            >
              <option value="">-- entidad completa --</option>
              {srcEntity?.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.isPk ? '# ' : f.isFk ? '→ ' : ''}
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <label className="insp-label">
            Campo destino{dstEntity ? ` (${dstEntity.name})` : ''}
            <select
              className="insp-input"
              value={relation.targetFieldId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onUpdateRelation(relationId, {
                  targetFieldId: v || undefined,
                });
              }}
            >
              <option value="">-- entidad completa --</option>
              {dstEntity?.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.isPk ? '# ' : f.isFk ? '→ ' : ''}
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {tab === 'import-export' && (
        <>
          {onImportPrisma && (
            <div>
              <div className="insp-section-title">Importar Prisma</div>
              <textarea
                className="insp-textarea"
                rows={6}
                value={drafts.prisma}
                placeholder="Pega tu esquema Prisma aqui..."
                onChange={(e) => updateDrafts({ prisma: e.target.value })}
              />
              <button
                type="button"
                className="mini-btn mini-btn-link"
                style={{ marginTop: 8 }}
                onClick={handleImport}
              >
                Importar
              </button>
            </div>
          )}

          {onImportDbml && (
            <DbmlImport
              onImport={onImportDbml}
              value={drafts.dbml}
              onChange={(v) => updateDrafts({ dbml: v })}
            />
          )}

          {exportData && (
            <>
              <div className="insp-section-title">Exportar Prisma</div>
              <div className="insp-code-block">
                <pre className="insp-code">{prismaCode}</pre>
                <button
                  type="button"
                  className="mini-btn mini-btn-link"
                  style={{ marginTop: 6 }}
                  onClick={handleCopyPrisma}
                >
                  Copiar Prisma
                </button>
              </div>

              <div className="insp-section-title">Exportar SQL</div>
              <div className="insp-code-block">
                <pre className="insp-code">{sqlCode}</pre>
                <button
                  type="button"
                  className="mini-btn mini-btn-link"
                  style={{ marginTop: 6 }}
                  onClick={handleCopySql}
                >
                  Copiar SQL
                </button>
              </div>
            </>
          )}
        </>
      )}
    </aside>
  );
}

export { uid };
