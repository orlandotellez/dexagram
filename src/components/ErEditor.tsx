import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import EntityNode, { type EntityNodeType } from './EntityNode';
import RelationEdge, { type RelationEdgeType } from './RelationEdge';
import { Inspector, type Selection } from './Inspector';
import { ShapePalette, type ShapeKind } from './ShapePalette';
import ThemeSwitcher from './ThemeSwitcher';
import { AlertDialog } from './ConfirmDialog';
import { readThemeColors } from '../lib/themes';
import {
  type Diagram,
  type Entity,
  type Field,
  type FieldHandleInfo,
  type Relation,
  emptyDiagram,
  fieldHandleId,
  normalizeSlug,
  parseFieldHandle,
  uid,
  uniqueSlug,
} from '../lib/model';
import {
  downloadFile,
  downloadJson,
  ensureBootstrap,
  findDiagramBySlugOrId,
  saveDiagrams,
  uploadJson,
} from '../lib/storage';
import { exportHtml } from '../lib/exportHtml';
import { parseErHtml } from '../lib/importHtml';





function toNodes(diagram: Diagram): EntityNodeType[] {
  return diagram.entities.map((entity) => ({
    id: entity.id,
    type: 'entity',
    position: { x: entity.x, y: entity.y },
    data: { entity },
  }));
}


function sideHandle(rel: Relation, end: 'source' | 'target'): string | undefined {
  if (end === 'source') {
    if (rel.sourceFieldId) return fieldHandleId(rel.sourceFieldId, rel.sourceSide ?? 'R', 'src');
    if (rel.sourceSide === 'L') return 'sl';
    if (rel.sourceSide === 'R') return 'sr';
    return undefined;
  }
  if (rel.targetFieldId) return fieldHandleId(rel.targetFieldId, rel.targetSide ?? 'L', 'tgt');
  if (rel.targetSide === 'L') return 'tl';
  if (rel.targetSide === 'R') return 'tr';
  return undefined;
}

function toEdges(diagram: Diagram): RelationEdgeType[] {
  return diagram.relations.map((relation) => ({
    id: relation.id,
    type: 'relation',
    source: relation.source,
    target: relation.target,
    sourceHandle: sideHandle(relation, 'source'),
    targetHandle: sideHandle(relation, 'target'),
    data: { relation },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--muted)', width: 14, height: 14 },
  }));
}

function toDiagram(title: string, subtitle: string, nodes: EntityNodeType[], edges: RelationEdgeType[]): Diagram {
  return {
    title,
    subtitle,
    entities: nodes.map((n) => ({ ...n.data!.entity, x: n.position.x, y: n.position.y })),
    relations: edges.map((e) => e.data!.relation),
  };
}


function sameEndpoints(
  edge: RelationEdgeType,
  conn: Connection,
  s: FieldHandleInfo | null,
  t: FieldHandleInfo | null,
): boolean {
  const r = edge.data?.relation;
  const eField = !!(r && r.sourceFieldId && r.targetFieldId);
  const cField = !!(s && t);
  if (eField && cField) {
    return (
      r.source === conn.source &&
      r.target === conn.target &&
      r.sourceFieldId === s.fieldId &&
      r.targetFieldId === t.fieldId
    );
  }
  if (!eField && !cField) {
    return (
      (edge.source === conn.source && edge.target === conn.target) ||
      (edge.source === conn.target && edge.target === conn.source)
    );
  }
  return false;
}





interface Boot {
  list: Diagram[];
  active: Diagram | null;
  activeId: string | null;
  groupId: string | undefined;
  notFound: boolean;
}

function computeBoot(slugOrId?: string): Boot {
  const { diagrams } = ensureBootstrap();
  const active = slugOrId ? findDiagramBySlugOrId(diagrams, slugOrId) : null;
  if (!active) {
    return { list: diagrams, active: null, activeId: null, groupId: undefined, notFound: true };
  }
  return { list: diagrams, active, activeId: active.id ?? null, groupId: active.groupId, notFound: false };
}

export default function ErEditor({ slug }: { slug?: string }) {
  const bootRef = useRef<Boot | null>(null);
  if (!bootRef.current) bootRef.current = computeBoot(slug);
  const boot = bootRef.current;

  const [diagrams, setDiagrams] = useState<Diagram[]>(boot.list);
  const [title, setTitle] = useState(boot.active?.title ?? '');
  const [subtitle, setSubtitle] = useState(boot.active?.subtitle ?? '');
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeType>(boot.active ? toNodes(boot.active) : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationEdgeType>(boot.active ? toEdges(boot.active) : []);
  const [slugValue, setSlugValue] = useState(boot.active?.slug ?? '');
  const [selection, setSelection] = useState<Selection>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<EntityNodeType, RelationEdgeType> | null>(null);
  const hasHydrated = useRef(false);
  const [alertState, setAlertState] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });

  const activeId = boot.activeId;
  const groupId = boot.groupId;

  const nodeTypes = useMemo(() => ({ entity: EntityNode }), []);
  const edgeTypes = useMemo(() => ({ relation: RelationEdge }), []);

    const handleTitleChange = (v: string) => setTitle(v);
  const handleSubtitleChange = (v: string) => setSubtitle(v);

    const handleSlugChange = (raw: string) => setSlugValue(normalizeSlug(raw));
  const handleSlugBlur = useCallback(() => {
    if (!slugValue) return;
    setSlugValue(uniqueSlug(slugValue, activeId ?? undefined, diagrams));
  }, [slugValue, activeId, diagrams]);

    useEffect(() => {
    if (!activeId) return;
    const path = `/diagrama/${slugValue || activeId}`;
    window.history.replaceState(null, '', path);
  }, [slugValue, activeId]);

    useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }
    if (!activeId) return;
    const current = toDiagram(title, subtitle, nodes, edges);
    setDiagrams((prev) => {
      const existing = prev.find((d) => d.id === activeId);
      const contentSame =
        !!existing &&
        existing.title === current.title &&
        existing.subtitle === current.subtitle &&
        (existing.slug ?? '') === slugValue &&
        existing.groupId === groupId &&
        JSON.stringify(existing.entities) === JSON.stringify(current.entities) &&
        JSON.stringify(existing.relations) === JSON.stringify(current.relations);
      const entry: Diagram = contentSame
        ? { ...existing!, id: activeId }
        : { ...current, id: activeId, slug: slugValue || undefined, groupId, savedAt: Date.now() };
      const next = existing ? prev.map((d) => (d.id === activeId ? entry : d)) : [entry, ...prev];
      const sorted = [...next].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
      saveDiagrams(sorted);
      return sorted;
    });
  }, [nodes, edges, title, subtitle, activeId, groupId, slugValue]);

    useEffect(() => {
    const connected = new Map<string, Set<string>>();
    for (const e of edges) {
      const rel = e.data?.relation;
      if (!rel) continue;
      if (rel.sourceFieldId) {
        if (!connected.has(rel.source)) connected.set(rel.source, new Set());
        connected.get(rel.source)!.add(rel.sourceFieldId);
      }
      if (rel.targetFieldId) {
        if (!connected.has(rel.target)) connected.set(rel.target, new Set());
        connected.get(rel.target)!.add(rel.targetFieldId);
      }
    }
    setNodes((nds) =>
      nds.map((n) => {
        const arr = connected.has(n.id) ? [...connected.get(n.id)!].sort() : [];
        const prev = n.data.connectedFieldIds ?? [];
        if (arr.length === prev.length && arr.every((f, i) => f === prev[i])) return n;
        return { ...n, data: { ...n.data, connectedFieldIds: arr } };
      }),
    );
  }, [edges, setNodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<EntityNodeType>[]) => {
      onNodesChange(changes);
            const posChanges = changes.filter(
        (c): c is Extract<NodeChange<EntityNodeType>, { type: 'position' }> =>
          c.type === 'position' && c.position !== undefined,
      );
      if (posChanges.length === 0) return;
      setNodes((nds) =>
        nds.map((n) => {
          const change = posChanges.find((c) => c.id === n.id);
          if (change) {
            return {
              ...n,
              data: { ...n.data, entity: { ...n.data!.entity, x: change.position!.x, y: change.position!.y } },
            };
          }
          return n;
        }),
      );
    },
    [onNodesChange, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<RelationEdgeType>[]) => {
      onEdgesChange(changes);
      if (changes.some((c) => c.type === 'remove')) {
        setSelection(null);
      }
    },
    [onEdgesChange],
  );

  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      const s = parseFieldHandle(conn.sourceHandle);
      const t = parseFieldHandle(conn.targetHandle);
      setEdges((eds) => {
        if (eds.some((e) => sameEndpoints(e, conn, s, t))) return eds;
        const relation: Relation = {
          id: uid(),
          source: conn.source,
          target: conn.target,
          sourceCard: '1',
          targetCard: 'N',
          label: '',
          sourceFieldId: s?.fieldId,
          targetFieldId: t?.fieldId,
          sourceSide: s?.side,
          targetSide: t?.side,
        };
        return addEdge(
          {
            id: relation.id,
            type: 'relation',
            source: conn.source,
            target: conn.target,
            sourceHandle: sideHandle(relation, 'source'),
            targetHandle: sideHandle(relation, 'target'),
            data: { relation },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--muted)', width: 14, height: 14 },
          },
          eds,
        );
      });
    },
    [setEdges],
  );

    const handleReconnect = useCallback(
    (oldEdge: RelationEdgeType, conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      const s = parseFieldHandle(conn.sourceHandle);
      const t = parseFieldHandle(conn.targetHandle);
      const next = (e: RelationEdgeType): RelationEdgeType => {
        const relation = {
          ...e.data!.relation,
          source: conn.source,
          target: conn.target,
          sourceFieldId: s?.fieldId,
          targetFieldId: t?.fieldId,
          sourceSide: s?.side,
          targetSide: t?.side,
        };
        return {
          ...e,
          source: conn.source,
          target: conn.target,
          sourceHandle: sideHandle(relation, 'source'),
          targetHandle: sideHandle(relation, 'target'),
          data: { relation },
        };
      };
      setEdges((eds) => {
        if (eds.some((e) => e.id !== oldEdge.id && sameEndpoints(e, conn, s, t))) return eds;
        return eds.map((e) => (e.id === oldEdge.id ? next(e) : e));
      });
      setSelection((sel) =>
        sel && sel.kind === 'relation' && sel.id === oldEdge.id
          ? {
            ...sel,
            relation: {
              ...sel.relation,
              source: conn.source,
              target: conn.target,
              sourceFieldId: s?.fieldId,
              targetFieldId: t?.fieldId,
              sourceSide: s?.side,
              targetSide: t?.side,
            },
          }
          : sel,
      );
    },
    [setEdges],
  );

  const handleSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: EntityNodeType[]; edges: RelationEdgeType[] }) => {
    const n = selNodes[0];
    const e = selEdges[0];
    if (n) {
      setSelection({ kind: 'entity', id: n.id, entity: n.data!.entity });
    } else if (e) {
      setSelection({ kind: 'relation', id: e.id, relation: e.data!.relation });
    } else {
      setSelection(null);
    }
  }, []);

  

  const updateEntity = useCallback(
    (id: string, patch: Partial<Entity>) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, entity: { ...n.data.entity, ...patch } } } : n)));
      setSelection((sel) => (sel && sel.kind === 'entity' && sel.id === id ? { ...sel, entity: { ...sel.entity, ...patch } } : sel));
    },
    [setNodes],
  );

  const addField = useCallback(
    (entityId: string) => {
      const newField: Field = { id: uid(), name: 'campo', isPk: false, isFk: false };
      setNodes((nds) =>
        nds.map((n) =>
          n.id === entityId
            ? { ...n, data: { ...n.data, entity: { ...n.data.entity, fields: [...n.data.entity.fields, newField] } } }
            : n,
        ),
      );
      setSelection((sel) =>
        sel && sel.kind === 'entity' && sel.id === entityId
          ? { ...sel, entity: { ...sel.entity, fields: [...sel.entity.fields, newField] } }
          : sel,
      );
    },
    [setNodes],
  );

  const updateField = useCallback(
    (entityId: string, fieldId: string, patch: Partial<Field>) => {
      const upd = (f: Field): Field => (f.id === fieldId ? { ...f, ...patch } : f);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === entityId ? { ...n, data: { ...n.data, entity: { ...n.data.entity, fields: n.data.entity.fields.map(upd) } } } : n,
        ),
      );
      setSelection((sel) =>
        sel && sel.kind === 'entity' && sel.id === entityId
          ? { ...sel, entity: { ...sel.entity, fields: sel.entity.fields.map(upd) } }
          : sel,
      );
    },
    [setNodes],
  );

  const removeField = useCallback(
    (entityId: string, fieldId: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === entityId
            ? { ...n, data: { ...n.data, entity: { ...n.data.entity, fields: n.data.entity.fields.filter((f) => f.id !== fieldId) } } }
            : n,
        ),
      );
      setSelection((sel) =>
        sel && sel.kind === 'entity' && sel.id === entityId
          ? { ...sel, entity: { ...sel.entity, fields: sel.entity.fields.filter((f) => f.id !== fieldId) } }
          : sel,
      );
    },
    [setNodes],
  );

  const deleteEntity = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelection(null);
    },
    [setNodes, setEdges],
  );

  

  const updateRelation = useCallback(
    (id: string, patch: Partial<Relation>) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== id) return e;
          const relation = { ...e.data!.relation, ...patch };
          return {
            ...e,
            source: relation.source,
            target: relation.target,
            sourceHandle: sideHandle(relation, 'source'),
            targetHandle: sideHandle(relation, 'target'),
            data: { relation },
          };
        }),
      );
      setSelection((sel) => (sel && sel.kind === 'relation' && sel.id === id ? { ...sel, relation: { ...sel.relation, ...patch } } : sel));
    },
    [setEdges],
  );

  const deleteRelation = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
      setSelection(null);
    },
    [setEdges],
  );

  

  const handleExport = useCallback(() => {
    const d = toDiagram(title, subtitle, nodes, edges);
    const slug = (title || 'diagrama')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'diagrama';
    const colors = readThemeColors();
    downloadFile(`${slug}.html`, exportHtml(d, colors), 'text/html');
  }, [title, subtitle, nodes, edges]);

  const handleSave = useCallback(() => {
    downloadJson({
      ...toDiagram(title, subtitle, nodes, edges),
      id: activeId ?? undefined,
      slug: slugValue || undefined,
      groupId,
      savedAt: Date.now(),
    });
  }, [title, subtitle, nodes, edges, activeId, slugValue, groupId]);

  const handleLoadFile = useCallback(
    async (file: File) => {
      try {
        const isHtml = /\.html?$/i.test(file.name) || file.type.includes('html');
        const d = isHtml ? parseErHtml(await file.text()) : await uploadJson(file);
        const entry: Diagram = { ...d, id: uid(), groupId, savedAt: Date.now() };
        setDiagrams((prev) => {
          const next = [entry, ...prev];
          saveDiagrams(next);
          return next;
        });
        window.location.assign(`/diagrama/${entry.id}`);
      } catch (err) {
        setAlertState({ open: true, title: 'Error', message: err instanceof Error ? err.message : 'No se pudo cargar el archivo' });
      }
    },
    [groupId],
  );

  

  const addShape = useCallback(
    (kind: ShapeKind, pos?: { x: number; y: number }) => {
      const flow = rfRef.current;
      let position = pos;
      if (!position && flow && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        position = flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
      position ??= { x: 120 + (nodes.length % 5) * 80, y: 80 + (nodes.length % 4) * 60 };
      const entity: Entity = {
        id: uid(),
        name: kind === 'focal' ? 'Entidad focal' : `Entidad ${nodes.length + 1}`,
        table: `entidad_${nodes.length + 1}`,
        focal: kind === 'focal',
        x: position.x,
        y: position.y,
        fields: [{ id: uid(), name: 'id', isPk: true, isFk: false }],
      };
      setNodes((nds) => [
        ...nds,
        { id: entity.id, type: 'entity', position: { x: entity.x, y: entity.y }, data: { entity } },
      ]);
      setSelection({ kind: 'entity', id: entity.id, entity });
    },
    [nodes.length, setNodes],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData('application/diagram-web');
      if (kind !== 'entity' && kind !== 'focal') return;
      const flow = rfRef.current;
      const pos = flow?.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (pos) addShape(kind, pos);
    },
    [addShape],
  );

  const entities = useMemo(() => nodes.map((n) => n.data!.entity), [nodes]);

  if (boot.notFound) {
    return (
      <div className="notfound">
        <p className="eyebrow">DIAGRAM WEB</p>
        <h1 className="notfound-title">Diagrama no encontrado</h1>
        <p className="notfound-text">El diagrama que buscás no existe o fue eliminado.</p>
        <a className="btn btn-primary" href="/">
          ← Volver a Mis diagramas
        </a>
      </div>
    );
  }

  return (
    <div className="editor">
      <header className="topbar">
        <div className="topbar-title">
          <input
            className="title-input"
            value={title}
            placeholder="Título del diagrama"
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <input
            className="subtitle-input"
            value={subtitle}
            placeholder="Subtítulo"
            onChange={(e) => handleSubtitleChange(e.target.value)}
          />
          <div className="slug-row">
            <span className="slug-prefix">/diagrama/</span>
            <input
              className="slug-input"
              value={slugValue}
              placeholder="slug (opcional)"
              title="Identificador para la URL del diagrama"
              onChange={(e) => handleSlugChange(e.target.value)}
              onBlur={handleSlugBlur}
            />
          </div>
        </div>
        <ThemeSwitcher />
        <div className="topbar-actions">
          <a className="btn btn-ghost" href="/">
            ← Mis diagramas
          </a>
          <button type="button" className="btn btn-ghost" onClick={() => {
            const d: Diagram = { ...emptyDiagram(), id: uid(), groupId, savedAt: Date.now() };
            setDiagrams((prev) => {
              const next = [d, ...prev];
              saveDiagrams(next);
              return next;
            });
            window.location.assign(`/diagrama/${d.id}`);
          }}>
            Nuevo
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            title="Importar un diagrama desde un archivo JSON o HTML exportado"
            onClick={() => fileInputRef.current?.click()}
          >
            Importar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.html,.htm,application/json,text/html"
            className="hidden-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLoadFile(f);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={handleSave}>
            Guardar JSON
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExport}>
            Exportar HTML
          </button>
        </div>
      </header>

      <div className="editor-body">
        <ShapePalette onAdd={(kind) => addShape(kind)} />
        <div className="canvas" ref={canvasRef}>
          <ReactFlow<EntityNodeType, RelationEdgeType>
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            onSelectionChange={handleSelectionChange}
            onInit={(inst) => {
              rfRef.current = inst;
            }}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.15}
            maxZoom={2}
            deleteKeyCode={['Backspace', 'Delete']}
            reconnectRadius={14}
            proOptions={{ hideAttribution: false }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--dot-color)" />
            <Controls />
            <MiniMap
              nodeColor={(n) => ((n.data as { entity?: Entity }).entity?.focal ? 'var(--accent)' : 'var(--node-bg)')}
              nodeStrokeWidth={2}
              maskColor="var(--minimap-mask)"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
        <Inspector
          selection={selection}
          entities={entities}
          onUpdateEntity={updateEntity}
          onUpdateField={updateField}
          onAddField={addField}
          onRemoveField={removeField}
          onUpdateRelation={updateRelation}
          onDeleteRelation={deleteRelation}
          onDeleteEntity={deleteEntity}
        />
      </div>

      <div className="canvas-hint">
        <span>
          Arrastrá formas de la paleta · conectá desde un punto (◦) de un campo · arrastrá un extremo de una línea para
          moverla · borrá con Supr
        </span>
        <span className="canvas-hint-right">Dexagram — editor ER</span>
      </div>

      <AlertDialog
        open={alertState.open}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
