export type ShapeKind = 'entity' | 'focal';

interface ShapePaletteProps {
  onAdd: (kind: ShapeKind) => void;
}

const SHAPES: { kind: ShapeKind; label: string; hint: string }[] = [
  { kind: 'entity', label: 'Entidad', hint: 'Caja ER con campos' },
  { kind: 'focal', label: 'Entidad focal', hint: 'Raíz del dominio (acento coral)' },
];

export function ShapePalette({ onAdd }: ShapePaletteProps) {
  return (
    <aside className="palette">
      <div className="palette-title">FORMAS</div>
      {SHAPES.map((s) => (
        <div
          key={s.kind}
          className={`shape-card${s.kind === 'focal' ? ' shape-card-focal' : ''}`}
          draggable
          title={`${s.label} — ${s.hint}. Arrastrá al lienzo o hacé clic para agregar.`}
          onDragStart={(e) => {
            e.dataTransfer.setData('application/diagram-web', s.kind);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={() => onAdd(s.kind)}
        >
          <div className="shape-preview">
            <span className="shape-tag">ENTITY</span>
            <span className="shape-name">{s.label}</span>
            <span className="shape-row"># id</span>
          </div>
        </div>
      ))}
      <p className="palette-hint">Arrastrá al lienzo o hacé clic para agregar.</p>
    </aside>
  );
}
