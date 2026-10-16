import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Diagram, Group } from '../lib/model';
import { emptyDiagram, uid } from '../lib/model';
import { ensureBootstrap, saveDiagrams, saveGroups, uploadJson } from '../lib/storage';
import { parseErHtml } from '../lib/importHtml';
import ThemeSwitcher from './ThemeSwitcher';
import { ConfirmDialog, AlertDialog } from './ConfirmDialog';

function relativeTime(ts: number | undefined): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days}d`;
  const d = new Date(ts);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function SquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function DiagramCard({
  d,
  groups,
  dragging,
  dropSide,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
  onOpen,
}: {
  d: Diagram;
  groups: Group[];
  dragging: boolean;
  dropSide: 'before' | 'after' | null;
  onDragStart: (id: string, e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (id: string, e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (id: string, e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, groupId: string | undefined) => void;
  onOpen: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.title);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const suppressedClickRef = useRef(false);

  const startEdit = () => {
    setDraft(d.title);
    setEditing(true);
    setShowMenu(false);
  };
  const commit = () => {
    if (!editing) return;
    const name = draft.trim();
    if (name && name !== d.title) onRename(d.id!, name);
    setEditing(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
      setShowMenu(false);
    }
  };

  const handleCardClick = () => {
    if (suppressedClickRef.current) return;
    if (!editing) onOpen(d.slug || d.id!);
  };

  // HTML5 DnD normally suppresses the click after a drop, but guard anyway so a
  // completed drag never also opens the diagram. Cleared on the next tick.
  const handleDragEnd = () => {
    suppressedClickRef.current = true;
    setTimeout(() => {
      suppressedClickRef.current = false;
    }, 0);
    onDragEnd();
  };

  return (
    <div
      className={`diagram-card${dragging ? ' diagram-card-dragging' : ''}${dropSide ? ` diagram-card-drop-${dropSide}` : ''}`}
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      draggable={!editing}
      onDragStart={(e) => onDragStart(d.id!, e)}
      onDragOver={(e) => onDragOver(d.id!, e)}
      onDrop={(e) => onDrop(d.id!, e)}
      onDragEnd={handleDragEnd}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(); }}
    >
      <div className="diagram-card-accent" />
      <div className="diagram-card-body">
        {editing ? (
          <input
            className="diagram-card-name-input"
            value={draft}
            autoFocus
            placeholder="Nombre del diagrama"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div className="diagram-card-name">{d.title || '(sin título)'}</div>
        )}
        <div className="diagram-card-stats">
          <span className="diagram-card-stat">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="0.8" />
              <line x1="1" y1="3.5" x2="9" y2="3.5" stroke="currentColor" strokeWidth="0.5" />
            </svg>
            {d.entities.length}
          </span>
          <span className="diagram-card-stat">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5 Q5 2 8 5" stroke="currentColor" strokeWidth="0.8" fill="none" />
              <path d="M2 5 Q5 8 8 5" stroke="currentColor" strokeWidth="0.8" fill="none" />
            </svg>
            {d.relations.length}
          </span>
          <span className="diagram-card-date">{relativeTime(d.savedAt)}</span>
        </div>
        {d.subtitle && <div className="diagram-card-subtitle">{d.subtitle}</div>}
      </div>
      <div className="diagram-card-menu" ref={menuRef} onBlur={handleBlur}>
        <button
          type="button"
          className="diagram-card-menu-btn"
          title="Más opciones"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="3" r="1.2" />
            <circle cx="7" cy="7" r="1.2" />
            <circle cx="7" cy="11" r="1.2" />
          </svg>
        </button>
        {showMenu && (
          <div className="diagram-card-dropdown" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="dropdown-item" onClick={startEdit}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" />
              </svg>
              Renombrar
            </button>
            <button type="button" className="dropdown-item" onClick={() => { onDuplicate(d.id!); setShowMenu(false); }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
                <path d="M8.5 3.5V1.5h-7v7h2" />
              </svg>
              Duplicar
            </button>
            <div className="dropdown-divider" />
            <select
              className="dropdown-select"
              value={d.groupId ?? ''}
              title="Mover a proyecto"
              onChange={(e) => { onMove(d.id!, e.target.value || undefined); setShowMenu(false); }}
            >
              <option value="">Sin grupo</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <div className="dropdown-divider" />
            <button type="button" className="dropdown-item dropdown-item-danger" onClick={() => { onDelete(d.id!); setShowMenu(false); }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M2 3h8M4.5 3V1.5h3V3M3 3v7.5h6V3" />
              </svg>
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function compareByOrder(a: Diagram, b: Diagram): number {
  return (
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
    (b.savedAt ?? 0) - (a.savedAt ?? 0)
  );
}

function nextOrderFor(diagrams: Diagram[], groupId: string | undefined): number {
  let min = 0;
  for (const d of diagrams) {
    if (d.groupId === groupId && d.order !== undefined && d.order < min) min = d.order;
  }
  return min - 1;
}

interface DialogState {
  open: boolean;
  title: string;
  message: string;
  danger?: boolean;
  confirmText?: string;
  onConfirm: () => void;
}

export default function HomePage() {
  const navigate = useNavigate();

  const bootRef = useRef<{ groups: Group[]; diagrams: Diagram[] } | null>(null);
  if (!bootRef.current) bootRef.current = ensureBootstrap();
  const boot = bootRef.current;

  const [groups, setGroups] = useState<Group[]>(boot.groups);
  const [diagrams, setDiagrams] = useState<Diagram[]>(boot.diagrams);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const [dragState, setDragState] = useState<{ draggedId: string | null; overId: string | null; after: boolean }>({
    draggedId: null,
    overId: null,
    after: false,
  });

  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });

  const openConfirm = useCallback((opts: Omit<DialogState, 'open'>) => {
    setDialog({ ...opts, open: true });
  }, []);

  const closeConfirm = useCallback(() => {
    setDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const openAlert = useCallback((title: string, message: string) => {
    setAlertDialog({ open: true, title, message });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const byGroup = useMemo(() => {
    const map = new Map<string | null, Diagram[]>();
    for (const d of diagrams) {
      const key = d.groupId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    // Sort each bucket in place: the arrays are fresh, so `diagrams` is never mutated.
    for (const list of map.values()) {
      list.sort(compareByOrder);
    }
    return map;
  }, [diagrams]);
  const ungrouped = byGroup.get(null) ?? [];

  const reorderDiagram = useCallback((draggedId: string, targetId: string, after: boolean) => {
    setDiagrams((prev) => {
      const dragged = prev.find((d) => d.id === draggedId);
      const target = prev.find((d) => d.id === targetId);
      // Reordering never crosses projects, never moves a card onto itself.
      if (!dragged || !target || draggedId === targetId || dragged.groupId !== target.groupId) return prev;
      const section = prev.filter((d) => d.groupId === dragged.groupId).sort(compareByOrder);
      const ids = section
        .map((d) => d.id)
        .filter((id): id is string => typeof id === 'string' && id !== draggedId);
      const targetIndex = ids.indexOf(targetId);
      if (targetIndex < 0) return prev;
      ids.splice(targetIndex + (after ? 1 : 0), 0, draggedId);
      const orderById = new Map(ids.map((id, index) => [id, index]));
      const next = prev.map((d) =>
        d.id !== undefined && orderById.has(d.id) ? { ...d, order: orderById.get(d.id)! } : d,
      );
      saveDiagrams(next);
      return next;
    });
  }, []);

  const createProject = () => {
    const n = groups.length + 1;
    const g: Group = { id: uid(), name: `Proyecto ${n}`, createdAt: Date.now() };
    // Prepend both so the new project sits at the top of the content, directly under the header.
    // That keeps its inline rename input visible without scrolling in a long list.
    setGroups((prev) => {
      const next = [g, ...prev];
      saveGroups(next);
      return next;
    });
    setDiagrams((prev) => {
      const d: Diagram = {
        ...emptyDiagram(),
        id: uid(),
        groupId: g.id,
        savedAt: Date.now(),
        order: nextOrderFor(prev, g.id),
      };
      const next = [d, ...prev];
      saveDiagrams(next);
      return next;
    });
    setGroupDraft(g.name);
    setEditingGroupId(g.id);
  };

  /**
   * Adds another diagram to an existing project. Unlike `createProject` this one
   * navigates straight into the editor: there is no inline name to confirm here,
   * and the diagram is created in order to work on it.
   */
  const createDiagram = (groupId: string) => {
    const id = uid();
    setDiagrams((prev) => {
      const d: Diagram = {
        ...emptyDiagram(),
        id,
        groupId,
        savedAt: Date.now(),
        order: nextOrderFor(prev, groupId),
      };
      const next = [d, ...prev];
      saveDiagrams(next);
      return next;
    });
    navigate(`/diagrama/${id}`);
  };

  const startRename = (g: Group) => {
    setGroupDraft(g.name);
    setEditingGroupId(g.id);
  };

  const commitRename = (id: string) => {
    const name = groupDraft.trim() || 'Proyecto';
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, name } : g));
      saveGroups(next);
      return next;
    });
    setEditingGroupId(null);
  };

  const deleteGroup = (id: string) => {
    const g = groups.find((x) => x.id === id);
    openConfirm({
      title: 'Eliminar proyecto',
      message: `¿Eliminar el proyecto "${g?.name ?? ''}"? Sus diagramas pasarán a "Sin grupo".`,
      danger: true,
      confirmText: 'Eliminar',
      onConfirm: () => {
        setGroups((prev) => {
          const next = prev.filter((x) => x.id !== id);
          saveGroups(next);
          return next;
        });
        setDiagrams((prev) => {
          const next = prev.map((d) => (d.groupId === id ? { ...d, groupId: undefined } : d));
          saveDiagrams(next);
          return next;
        });
        closeConfirm();
      },
    });
  };

  const duplicateDiagram = (id: string) => {
    const src = diagrams.find((d) => d.id === id);
    if (!src) return;
    const copy: Diagram = {
      ...src,
      id: uid(),
      title: `${src.title || 'Diagrama'} (copia)`,
      savedAt: Date.now(),
      entities: src.entities.map((e) => ({ ...e, fields: e.fields.map((f) => ({ ...f })) })),
      relations: src.relations.map((r) => ({ ...r })),
    };
    setDiagrams((prev) => {
      const withOrder: Diagram = { ...copy, order: nextOrderFor(prev, copy.groupId) };
      const next = [withOrder, ...prev];
      saveDiagrams(next);
      return next;
    });
  };

  const deleteDiagram = (id: string) => {
    const d = diagrams.find((x) => x.id === id);
    openConfirm({
      title: 'Eliminar diagrama',
      message: `¿Eliminar el diagrama "${d?.title || 'sin título'}"? Esta acción no se puede deshacer.`,
      danger: true,
      confirmText: 'Eliminar',
      onConfirm: () => {
        setDiagrams((prev) => {
          const next = prev.filter((x) => x.id !== id);
          saveDiagrams(next);
          return next;
        });
        closeConfirm();
      },
    });
  };

  const moveDiagram = (id: string, groupId: string | undefined) => {
    setDiagrams((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, groupId } : d));
      saveDiagrams(next);
      return next;
    });
  };

  const renameDiagram = (id: string, title: string) => {
    setDiagrams((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, title, savedAt: Date.now() } : d));
      saveDiagrams(next);
      return next;
    });
  };

  const importFile = async (file: File) => {
    try {
      const isHtml = /\.html?$/i.test(file.name) || file.type.includes('html');
      const d = isHtml ? parseErHtml(await file.text()) : await uploadJson(file);
      // An imported file may carry a stale groupId, so always bind it to a fresh project.
      const projectId = uid();
      const entry: Diagram = { ...d, id: uid(), groupId: projectId, savedAt: Date.now() };
      // `uploadJson` only validates `entities`, so `title` can be missing in a hand-made file.
      const projectName = (d.title ?? '').trim() || 'Importado';
      const g: Group = { id: projectId, name: projectName, createdAt: Date.now() };
      setGroups((prev) => {
        const next = [g, ...prev];
        saveGroups(next);
        return next;
      });
      setDiagrams((prev) => {
        const next = [entry, ...prev];
        saveDiagrams(next);
        return next;
      });
      navigate(`/diagrama/${entry.id}`);
    } catch (err) {
      openAlert('Error', err instanceof Error ? err.message : 'No se pudo importar el archivo');
    }
  };

  const isEmpty = groups.length === 0 && diagrams.length === 0;

  const clearDragState = useCallback(() => {
    setDragState({ draggedId: null, overId: null, after: false });
  }, []);

  const handleCardDragStart = useCallback((id: string, e: React.DragEvent<HTMLDivElement>) => {
    setDragState({ draggedId: id, overId: null, after: false });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, []);

  const handleCardDragOver = useCallback(
    (targetId: string, e: React.DragEvent<HTMLDivElement>) => {
      const draggedId = dragState.draggedId;
      const dragged = draggedId ? diagrams.find((d) => d.id === draggedId) : undefined;
      const target = diagrams.find((d) => d.id === targetId);
      // No indicator (and no allowed drop) outside the dragged card's own project.
      if (!dragged || !target || draggedId === targetId || dragged.groupId !== target.groupId) {
        setDragState((prev) => (prev.overId === null ? prev : { ...prev, overId: null, after: false }));
        return;
      }
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const after = e.clientX > rect.left + rect.width / 2;
      // dragover fires continuously while dragging: reuse the previous object when
      // nothing actually changed so the grid does not re-render on every tick.
      setDragState((prev) =>
        prev.overId === targetId && prev.after === after
          ? prev
          : { draggedId, overId: targetId, after },
      );
    },
    [diagrams, dragState.draggedId],
  );

  const handleCardDrop = useCallback(
    (targetId: string, e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const draggedId = dragState.draggedId;
      if (draggedId && draggedId !== targetId) {
        const rect = e.currentTarget.getBoundingClientRect();
        const after = e.clientX > rect.left + rect.width / 2;
        reorderDiagram(draggedId, targetId, after);
      }
      setDragState({ draggedId: null, overId: null, after: false });
    },
    [dragState.draggedId, reorderDiagram],
  );

  const renderDiagramCards = (list: Diagram[]) =>
    list.map((d) => (
      <DiagramCard
        key={d.id}
        d={d}
        groups={groups}
        dragging={dragState.draggedId === d.id}
        dropSide={dragState.overId === d.id ? (dragState.after ? 'after' : 'before') : null}
        onDragStart={handleCardDragStart}
        onDragOver={handleCardDragOver}
        onDrop={handleCardDrop}
        onDragEnd={clearDragState}
        onRename={renameDiagram}
        onDuplicate={duplicateDiagram}
        onDelete={deleteDiagram}
        onMove={moveDiagram}
        onOpen={(slug) => navigate(`/diagrama/${slug}`)}
      />
    ));

  return (
    <div className="home-layout">
      <div className="home-main-area">
        <header className="home-topbar">
          <div className="home-topbar-bar">
            <div className="home-brand">
              <SquareIcon className="home-brand-logo" />
              <span className="home-brand-text">Dexagram</span>
            </div>
            <div className="home-topbar-actions">
              <button type="button" className="btn btn-primary" onClick={createProject} aria-label="Nuevo proyecto">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="1" y="2" width="12" height="10" rx="1.5" />
                  <line x1="1" y1="5" x2="13" y2="5" />
                </svg>
                <span className="header-action-label">Nuevo proyecto</span>
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => importInputRef.current?.click()} aria-label="Importar">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10" />
                </svg>
                <span className="header-action-label">Importar</span>
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,.html,.htm,application/json,text/html"
                className="hidden-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFile(f);
                  e.target.value = '';
                }}
              />
              <ThemeSwitcher />
            </div>
          </div>
          <div className="home-heading">
            <h1 className="home-title">Mis diagramas</h1>
            <div className="home-stats">
              <span className="home-stat">
                <strong>{diagrams.length}</strong> diagrama{diagrams.length === 1 ? '' : 's'}
              </span>
              <span className="home-stat-sep">·</span>
              <span className="home-stat">
                <strong>{groups.length}</strong> proyecto{groups.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </header>

        <main className="home-content">
          {isEmpty && (
            <div className="home-empty-state">
              <SquareIcon className="home-empty-icon" />
              <h2 className="home-empty-title">Empezá a diseñar</h2>
              <p className="home-empty-text">
                Creá tu primer proyecto: se crea junto con su diagrama entidad-relación para visualizar el modelo de tu base de datos.
              </p>
              <div className="home-empty-actions">
                <button type="button" className="btn btn-primary btn-lg" onClick={createProject}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="7" y1="1" x2="7" y2="13" />
                    <line x1="1" y1="7" x2="13" y2="7" />
                  </svg>
                  Crear proyecto
                </button>
              </div>
            </div>
          )}

          {groups.map((g) => {
            const groupDiagrams = byGroup.get(g.id) ?? [];
            return (
              <section key={g.id} className="group-section">
                <div className="group-header">
                  {editingGroupId === g.id ? (
                    <input
                      className="group-name-input"
                      value={groupDraft}
                      autoFocus
                      placeholder="Nombre del proyecto"
                      onChange={(e) => setGroupDraft(e.target.value)}
                      onBlur={() => commitRename(g.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(g.id);
                        if (e.key === 'Escape') setEditingGroupId(null);
                      }}
                    />
                  ) : (
                    <>
                      <h2 className="group-name">{g.name}</h2>
                      <span className="badge">{groupDiagrams.length}</span>
                      <button type="button" className="icon-btn" title="Renombrar proyecto" onClick={() => startRename(g)}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                          <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" />
                        </svg>
                      </button>
                      <button type="button" className="icon-btn danger" title="Eliminar proyecto" onClick={() => deleteGroup(g.id)}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                          <path d="M2 3h8M4.5 3V1.5h3V3M3 3v7.5h6V3" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button type="button" className="mini-btn group-add" title="Agregar diagrama al proyecto" onClick={() => createDiagram(g.id)}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <line x1="5" y1="1" x2="5" y2="9" />
                      <line x1="1" y1="5" x2="9" y2="5" />
                    </svg>
                    Diagrama
                  </button>
                </div>
                <div className="diagram-grid">
                  {groupDiagrams.length === 0 && <p className="diagram-empty">Sin diagramas todavía.</p>}
                  {renderDiagramCards(groupDiagrams)}
                </div>
              </section>
            );
          })}

          {ungrouped.length > 0 && (
            <section className="group-section">
              <div className="group-header">
                <h2 className="group-name group-name-muted">Sin grupo</h2>
                <span className="badge badge-muted">{ungrouped.length}</span>
              </div>
              <div className="diagram-grid">{renderDiagramCards(ungrouped)}</div>
            </section>
          )}
        </main>

        <footer className="home-footer">
          <span className="home-footer-text">
            dexagram · modelo entidad-relación · datos guardados localmente
          </span>
        </footer>
      </div>

      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        danger={dialog.danger}
        confirmText={dialog.confirmText}
        onConfirm={dialog.onConfirm}
        onCancel={closeConfirm}
      />

      <AlertDialog
        open={alertDialog.open}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={closeAlert}
      />
    </div>
  );
}
