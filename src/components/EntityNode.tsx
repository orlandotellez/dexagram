import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { fieldHandleId, type Entity } from '../lib/model';

export type EntityNodeData = { entity: Entity; connectedFieldIds?: string[] };
export type EntityNodeType = Node<EntityNodeData, 'entity'>;

function EntityNodeComponent({ data, selected }: NodeProps<EntityNodeType>) {
  const { entity, connectedFieldIds } = data;
  const cls = [
    'er-node',
    entity.focal ? 'er-node-focal' : '',
    selected ? 'er-node-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      {}
      <Handle type="target" position={Position.Left} id="tl" className="er-handle" />
      <Handle type="source" position={Position.Left} id="sl" className="er-handle" />
      <Handle type="target" position={Position.Right} id="tr" className="er-handle" />
      <Handle type="source" position={Position.Right} id="sr" className="er-handle" />

      <div className="er-tag">ENTITY</div>
      <div className="er-name">{entity.name || 'Sin nombre'}</div>
      <div className="er-table">{entity.table}</div>
      <div className="er-divider" />
      <div className="er-fields">
        {entity.fields.length === 0 && <div className="er-field er-field-empty">— sin campos —</div>}
        {entity.fields.map((f) => {
          const connected = !!connectedFieldIds?.includes(f.id);
          return (
            <div
              key={f.id}
              className={`er-field${f.isFk ? ' er-field-fk' : ''}${connected ? ' er-field-connected' : ''}`}
            >
              {}
              <Handle
                type="target"
                position={Position.Left}
                id={fieldHandleId(f.id, 'L', 'tgt')}
                className="er-handle er-field-handle"
              />
              <Handle
                type="source"
                position={Position.Left}
                id={fieldHandleId(f.id, 'L', 'src')}
                className="er-handle er-field-handle"
              />
              <span className="er-field-label">
                <span className="er-field-prefix">{f.isPk ? '# ' : f.isFk ? '→ ' : ''}</span>
                {f.name}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={fieldHandleId(f.id, 'R', 'src')}
                className="er-handle er-field-handle"
              />
              <Handle
                type="target"
                position={Position.Right}
                id={fieldHandleId(f.id, 'R', 'tgt')}
                className="er-handle er-field-handle"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(EntityNodeComponent);
