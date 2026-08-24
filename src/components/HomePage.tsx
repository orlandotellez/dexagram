import { useMemo, useRef, useState } from 'react';
import type { Diagram, Group } from '../lib/model';
import { emptyDiagram, uid } from '../lib/model';
import { ensureBootstrap, saveDiagrams, saveGroups, uploadJson } from '../lib/storage';
import { parseErHtml } from '../lib/importHtml';
import ThemeSwitcher from './ThemeSwitcher';

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

function ErDiagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="14" width="42" height="52" rx="4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.3" />
      <rect x="8" y="14" width="42" height="14" rx="4" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06" />
      <rect x="12" y="18" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.4" />
      <line x1="8" y1="28" x2="50" y2="28" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="14" y1="36" x2="44" y2="36" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
      <line x1="14" y1="42" x2="44" y2="42" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
      <line x1="14" y1="48" x2="38" y2="48" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
      <rect x="70" y="8" width="42" height="44" rx="4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.3" />
      <rect x="70" y="8" width="42" height="14" rx="4" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06" />
      <rect x="74" y="12" width="12" height="5" rx="1" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.4" />
      <line x1="70" y1="22" x2="112" y2="22" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="76" y1="30" x2="106" y2="30" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
      <line x1="76" y1="36" x2="106" y2="36" stroke="currentColor" strokeWidth="0.6" opacity="0.2" />
      <rect x="70" y="48" width="42" height="30" rx="4" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.25" />
      <rect x="70" y="48" width="42" height="14" rx="4" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06" />
      <rect x="74" y="52" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.35" />
      <line x1="70" y1="62" x2="112" y2="62" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      <line x1="76" y1="70" x2="100" y2="70" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
      <path d="M50 30 Q60 30 60 20 Q60 14 70 14" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2" fill="none" opacity="0.35" />
      <path d="M50 38 Q60 38 60 58 Q60 62 70 58" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2" fill="none" opacity="0.3" />
      <circle cx="70" cy="14" r="2" fill="currentColor" opacity="0.25" />
      <circle cx="70" cy="58" r="2" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

function DiagramCard({
  d,
  groups,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
}: {
  d: Diagram;
  groups: Group[];
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, groupId: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.title);
  const [showMenu, setShowMenu] = useState(false);
  const href = `/diagrama/${d.slug || d.id}`;
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <a className="diagram-card" href={editing ? undefined : href} onClick={(e) => editing && e.preventDefault()}>
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
            e.preventDefault();
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
          <div className="diagram-card-dropdown">
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
    </a>
  );
}

export default function HomePage() {
  const bootRef = useRef<{ groups: Group[]; diagrams: Diagram[] } | null>(null);
  if (!bootRef.current) bootRef.current = ensureBootstrap();
  const boot = bootRef.current;

  const [groups, setGroups] = useState<Group[]>(boot.groups);
  const [diagrams, setDiagrams] = useState<Diagram[]>(boot.diagrams);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  const sortedDiagrams = useMemo(
    () => [...diagrams].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)),
    [diagrams],
  );

  const filteredDiagrams = useMemo(() => {
    if (!search.trim()) return sortedDiagrams;
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return sortedDiagrams.filter((d) => {
      const hay = (d.title + ' ' + d.subtitle).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return hay.includes(q);
    });
  }, [sortedDiagrams, search]);

  const byGroup = useMemo(() => {
    const map = new Map<string | null, Diagram[]>();
    for (const d of filteredDiagrams) {
      const key = d.groupId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [filteredDiagrams]);
  const ungrouped = byGroup.get(null) ?? [];

  const createGroup = () => {
    const n = groups.length + 1;
    const g: Group = { id: uid(), name: `Proyecto ${n}`, createdAt: Date.now() };
    setGroups((prev) => {
      const next = [...prev, g];
      saveGroups(next);
      return next;
    });
    setGroupDraft(g.name);
    setEditingGroupId(g.id);
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
    if (!confirm(`¿Eliminar el proyecto "${g?.name ?? ''}"? Sus diagramas pasarán a "Sin grupo".`)) return;
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
  };

  const createDiagram = (groupId: string | undefined) => {
    const d: Diagram = { ...emptyDiagram(), id: uid(), groupId, savedAt: Date.now() };
    setDiagrams((prev) => {
      const next = [d, ...prev];
      saveDiagrams(next);
      return next;
    });
    window.location.assign(`/diagrama/${d.id}`);
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
      const next = [copy, ...prev];
      saveDiagrams(next);
      return next;
    });
  };

  const deleteDiagram = (id: string) => {
    const d = diagrams.find((x) => x.id === id);
    if (!confirm(`¿Eliminar el diagrama "${d?.title || 'sin título'}"?`)) return;
    setDiagrams((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveDiagrams(next);
      return next;
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
      const entry: Diagram = { ...d, id: uid(), savedAt: Date.now() };
      setDiagrams((prev) => {
        const next = [entry, ...prev];
        saveDiagrams(next);
        return next;
      });
      window.location.assign(`/diagrama/${entry.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo importar el archivo');
    }
  };

  const isEmpty = groups.length === 0 && diagrams.length === 0;
  const hasResults = groups.length > 0 || filteredDiagrams.length > 0;
  const isSearching = search.trim().length > 0;

  const renderDiagramCards = (list: Diagram[]) =>
    list.map((d) => (
      <DiagramCard
        key={d.id}
        d={d}
        groups={groups}
        onRename={renameDiagram}
        onDuplicate={duplicateDiagram}
        onDelete={deleteDiagram}
        onMove={moveDiagram}
      />
    ));

  return (
    <div className="home-layout">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <ErDiagramIcon className="sidebar-logo" />
            {sidebarOpen && <span className="sidebar-brand-text">Dexagram</span>}
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Contraer sidebar' : 'Expandir sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              {sidebarOpen ? (
                <path d="M10 3L5 8l5 5" />
              ) : (
                <path d="M6 3l5 5-5 5" />
              )}
            </svg>
          </button>
        </div>

        <div className="sidebar-content">
          <button type="button" className="sidebar-btn sidebar-btn-primary" onClick={() => createDiagram(undefined)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="7" y1="1" x2="7" y2="13" />
              <line x1="1" y1="7" x2="13" y2="7" />
            </svg>
            {sidebarOpen && 'Nuevo diagrama'}
          </button>

          {sidebarOpen && (
            <button type="button" className="sidebar-btn" onClick={createGroup}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="2" width="12" height="10" rx="1.5" />
                <line x1="1" y1="5" x2="13" y2="5" />
              </svg>
              Nuevo proyecto
            </button>
          )}

          {sidebarOpen && (
            <button type="button" className="sidebar-btn" onClick={() => importInputRef.current?.click()}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M7 1v8M4 6l3 3 3-3M2 11h10" />
              </svg>
              Importar
            </button>
          )}
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

          {sidebarOpen && groups.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Proyectos</div>
              {groups.map((g) => {
                const count = diagrams.filter((d) => d.groupId === g.id).length;
                return (
                  <div key={g.id} className="sidebar-project">
                    {editingGroupId === g.id ? (
                      <input
                        className="sidebar-project-input"
                        value={groupDraft}
                        autoFocus
                        onChange={(e) => setGroupDraft(e.target.value)}
                        onBlur={() => commitRename(g.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(g.id);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                      />
                    ) : (
                      <>
                        <span className="sidebar-project-name">{g.name}</span>
                        <span className="sidebar-project-count">{count}</span>
                        <button type="button" className="sidebar-project-btn" title="Renombrar" onClick={() => startRename(g)}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" />
                          </svg>
                        </button>
                        <button type="button" className="sidebar-project-btn sidebar-project-btn-danger" title="Eliminar" onClick={() => deleteGroup(g.id)}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M2 3h8M4.5 3V1.5h3V3M3 3v7.5h6V3" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <ThemeSwitcher />
        </div>
      </aside>

      <div className="home-main-area">
        <header className="home-topbar">
          <div className="home-topbar-left">
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
          <div className="home-search">
            <svg className="home-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="5.5" cy="5.5" r="4" />
              <line x1="8.5" y1="8.5" x2="12.5" y2="12.5" />
            </svg>
            <input
              className="home-search-input"
              type="search"
              placeholder="Buscar diagrama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {isSearching && (
              <button className="home-search-clear" type="button" onClick={() => setSearch('')} title="Limpiar búsqueda">
                ×
              </button>
            )}
          </div>
        </header>

        <main className="home-content">
          {isEmpty && (
            <div className="home-empty-state">
              <ErDiagramIcon className="home-empty-icon" />
              <h2 className="home-empty-title">Empezá a diseñar</h2>
              <p className="home-empty-text">
                Creá tu primer diagrama entidad-relación para visualizar el modelo de tu base de datos.
              </p>
              <div className="home-empty-actions">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => createDiagram(undefined)}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="7" y1="1" x2="7" y2="13" />
                    <line x1="1" y1="7" x2="13" y2="7" />
                  </svg>
                  Nuevo diagrama
                </button>
                <button type="button" className="btn btn-ghost" onClick={createGroup}>
                  Crear proyecto
                </button>
              </div>
            </div>
          )}

          {isSearching && !hasResults && (
            <div className="home-empty-state">
              <svg className="home-empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="20" cy="20" r="14" />
                <line x1="30" y1="30" x2="42" y2="42" />
                <line x1="14" y1="20" x2="26" y2="20" />
              </svg>
              <h2 className="home-empty-title">Sin resultados</h2>
              <p className="home-empty-text">
                No se encontraron diagramas para "{search}". Probá con otro término.
              </p>
            </div>
          )}

          {groups.map((g) => {
            const groupDiagrams = byGroup.get(g.id) ?? [];
            if (isSearching && groupDiagrams.length === 0) return null;
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
                  <button type="button" className="mini-btn group-add" onClick={() => createDiagram(g.id)}>
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
                <button type="button" className="mini-btn group-add" onClick={() => createDiagram(undefined)}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <line x1="5" y1="1" x2="5" y2="9" />
                    <line x1="1" y1="5" x2="9" y2="5" />
                  </svg>
                  Diagrama
                </button>
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
    </div>
  );
}
