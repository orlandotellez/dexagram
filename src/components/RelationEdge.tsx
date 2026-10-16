import { memo, useContext } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import type { Relation } from '../lib/model';
import { RelationActionsContext } from './relationActions';

export type RelationEdgeData = { relation: Relation };
export type RelationEdgeType = Edge<RelationEdgeData, 'relation'>;

function RelationEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<RelationEdgeType>) {
  const relation = data?.relation;
  const relationActions = useContext(RelationActionsContext);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

    const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const srcPos = { x: sourceX + ux * 22, y: sourceY + uy * 22 };
  const tgtPos = { x: targetX - ux * 22, y: targetY - uy * 22 };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? 'var(--accent)' : 'var(--muted)',
          strokeWidth: selected ? 1.6 : 1,
        }}
      />
      <EdgeLabelRenderer>
        {relation && relation.label && (
          <div
            className="er-edge-label er-edge-rel"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {relation.label}
          </div>
        )}
        {relation && (
          <>
            <div
              className="er-edge-label er-edge-card"
              style={{ transform: `translate(-50%, -50%) translate(${srcPos.x}px, ${srcPos.y}px)` }}
            >
              {relation.sourceCard}
            </div>
            <div
              className="er-edge-label er-edge-card"
              style={{ transform: `translate(-50%, -50%) translate(${tgtPos.x}px, ${tgtPos.y}px)` }}
            >
              {relation.targetCard}
            </div>
          </>
        )}
        {selected && relationActions && (
          <button
            type="button"
            className="er-edge-action nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 16}px)` }}
            title="Invertir lados (F)"
            aria-label="Invertir lados de la relación"
            onClick={(e) => {
              e.stopPropagation();
              relationActions.flip(id);
            }}
          >
            ⇄
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(RelationEdgeComponent);
