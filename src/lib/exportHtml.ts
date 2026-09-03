import type { Diagram, Entity, Relation } from "./model";
import type { ThemeColors } from "./themes";

const LUNA: ThemeColors = {
  paper: "#faf7fc",
  ink: "#2d1b2e",
  muted: "#70527a",
  soft: "#8a7091",
  accent: "#cb5bce",
  accentTint: "rgba(203,91,206,0.08)",
  hairline: "rgba(45,27,46,0.12)",
  hairlineSoft: "rgba(45,27,46,0.10)",
  nodeBg: "#ffffff",
  tagBorder: "rgba(45,27,46,0.40)",
};

const MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const SANS =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/* Geometría                                                           */
/* ------------------------------------------------------------------ */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Misma métrica que el nodo del editor: header 40 + filas de 16 + 8. */
export function entitySize(entity: Entity): { w: number; h: number } {
  return { w: 200, h: 40 + entity.fields.length * 16 + 8 };
}

type Side = "left" | "right" | "top" | "bottom";

function sideBetween(sr: Rect, dr: Rect): [Side, Side] {
  const dx = dr.x + dr.w / 2 - (sr.x + sr.w / 2);
  const dy = dr.y + dr.h / 2 - (sr.y + sr.h / 2);
  if (Math.abs(dx) >= Math.abs(dy))
    return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

function attachPoint(
  r: Rect,
  side: Side,
  idx: number,
  count: number,
): { x: number; y: number } {
  const span = side === "left" || side === "right" ? r.h : r.w;
  const offset = (span / (count + 1)) * (idx + 1);
  switch (side) {
    case "left":
      return { x: r.x, y: r.y + offset };
    case "right":
      return { x: r.x + r.w, y: r.y + offset };
    case "top":
      return { x: r.x + offset, y: r.y };
    case "bottom":
      return { x: r.x + offset, y: r.y + r.h };
  }
}

/** Polilínea ortogonal con esquinas redondeadas (r=8). */
function roundedPath(pts: [number, number][], r = 8): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const lenIn = Math.hypot(cx - px, cy - py);
    const lenOut = Math.hypot(nx - cx, ny - cy);
    if (lenIn === 0 || lenOut === 0) {
      d += ` L ${cx} ${cy}`;
      continue;
    }
    const rr = Math.min(r, lenIn / 2, lenOut / 2);
    const ix = cx - ((cx - px) / lenIn) * rr;
    const iy = cy - ((cy - py) / lenIn) * rr;
    const ox = cx + ((nx - cx) / lenOut) * rr;
    const oy = cy + ((ny - cy) / lenOut) * rr;
    d += ` L ${round4(ix)} ${round4(iy)} Q ${cx} ${cy} ${round4(ox)} ${round4(oy)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

function round4(v: number): number {
  return Math.round(v * 4) / 4;
}

interface Route {
  path: string;
  mid: { x1: number; y1: number; x2: number; y2: number };
  first: { x1: number; y1: number; x2: number; y2: number };
  last: { x1: number; y1: number; x2: number; y2: number };
}

function route(
  a: { x: number; y: number },
  b: { x: number; y: number },
  exit: Side,
  lane: number,
  laneCount: number,
): Route {
  const horizontal = exit === "left" || exit === "right";
  const laneOff = (lane - (laneCount - 1) / 2) * 16;

  if (horizontal) {
    const midX = (a.x + b.x) / 2 + laneOff;
    return {
      path: roundedPath([
        [a.x, a.y],
        [midX, a.y],
        [midX, b.y],
        [b.x, b.y],
      ]),
      mid: { x1: midX, y1: a.y, x2: midX, y2: b.y },
      first: { x1: a.x, y1: a.y, x2: midX, y2: a.y },
      last: { x1: midX, y1: b.y, x2: b.x, y2: b.y },
    };
  }

  const midY = (a.y + b.y) / 2 + laneOff;
  return {
    path: roundedPath([
      [a.x, a.y],
      [a.x, midY],
      [b.x, midY],
      [b.x, b.y],
    ]),
    mid: { x1: a.x, y1: midY, x2: b.x, y2: midY },
    first: { x1: a.x, y1: a.y, x2: a.x, y2: midY },
    last: { x1: b.x, y1: midY, x2: b.x, y2: b.y },
  };
}

/* ------------------------------------------------------------------ */
/* Labels con máscara                                                  */
/* ------------------------------------------------------------------ */

function labelAbove(
  text: string,
  x: number,
  lineY: number,
  fill: string,
  bg: string,
  gap = 14,
): string {
  const w = Math.max(12, text.length * 6.5 + 8);
  const ly = lineY - gap - 12;
  return [
    `<rect x="${round4(x - w / 2)}" y="${round4(ly)}" width="${round4(w)}" height="12" rx="2" fill="${bg}"/>`,
    `<text x="${round4(x)}" y="${round4(ly + 9)}" fill="${fill}" font-size="8" font-family="${MONO}" text-anchor="middle" letter-spacing="0.06em">${esc(text)}</text>`,
  ].join("\n");
}

function labelRight(
  text: string,
  lineX: number,
  y: number,
  fill: string,
  bg: string,
  gap = 12,
): string {
  const w = Math.max(12, text.length * 6.5 + 8);
  const lx = lineX + gap;
  return [
    `<rect x="${round4(lx)}" y="${round4(y - 6)}" width="${round4(w)}" height="12" rx="2" fill="${bg}"/>`,
    `<text x="${round4(lx + w / 2)}" y="${round4(y + 3)}" fill="${fill}" font-size="8" font-family="${MONO}" text-anchor="middle" letter-spacing="0.06em">${esc(text)}</text>`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Nodos                                                               */
/* ------------------------------------------------------------------ */

function entitySvg(e: Entity, r: Rect, C: ThemeColors): string {
  const focal = !!e.focal;
  const stroke = focal ? C.accent : C.ink;
  const fill = focal ? C.accentTint : C.nodeBg;
  const tagStroke = focal ? C.accent : C.tagBorder;
  const tagFill = focal ? C.accent : C.muted;
  const cx = r.x + r.w / 2;
  const out: string[] = [];

  out.push(
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${C.paper}"/>`,
  );
  out.push(
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
  );

  out.push(
    `<rect x="${r.x + 8}" y="${r.y + 6}" width="44" height="12" rx="2" fill="transparent" stroke="${tagStroke}" stroke-width="0.8"/>`,
  );
  out.push(
    `<text x="${r.x + 30}" y="${r.y + 15}" fill="${tagFill}" font-size="7" font-family="${MONO}" text-anchor="middle" letter-spacing="0.08em">ENTITY</text>`,
  );

  out.push(
    `<text x="${cx}" y="${r.y + 13}" fill="${C.ink}" font-size="12" font-weight="600" font-family="${SANS}" text-anchor="middle">${esc(e.name)}</text>`,
  );
  out.push(
    `<text x="${cx}" y="${r.y + 31}" fill="${C.muted}" font-size="9" font-family="${MONO}" text-anchor="middle">${esc(e.table)}</text>`,
  );

  out.push(
    `<line x1="${r.x}" y1="${r.y + 40}" x2="${r.x + r.w}" y2="${r.y + 40}" stroke="${C.hairline}" stroke-width="0.8"/>`,
  );

  e.fields.forEach((f, i) => {
    const fy = r.y + 55 + i * 16;
    const prefix = f.isPk ? "# " : f.isFk ? "→ " : "";
    const color = f.isFk ? C.muted : C.ink;
    out.push(
      `<text x="${r.x + 12}" y="${fy}" fill="${color}" font-size="9" font-family="${MONO}">${esc(prefix + f.name)}</text>`,
    );
  });

  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* Export principal                                                    */
/* ------------------------------------------------------------------ */

export function exportHtml(diagram: Diagram, colors?: ThemeColors): string {
  const C = colors ?? LUNA;

  const rects = new Map<string, Rect>();
  for (const e of diagram.entities) {
    const { w, h } = entitySize(e);
    rects.set(e.id, { x: e.x, y: e.y, w, h });
  }

  const pad = 40;
  const legendH = 60;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of diagram.entities) {
    const r = rects.get(e.id)!;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 400;
    maxY = 300;
  }
  const offX = Math.floor(minX / 4) * 4 - pad;
  const offY = Math.floor(minY / 4) * 4 - pad;
  const W = Math.ceil((maxX - offX + pad) / 4) * 4;
  const H = Math.ceil((maxY - offY + pad + legendH) / 4) * 4;

  const tr = (r: Rect): Rect => ({
    x: r.x - offX,
    y: r.y - offY,
    w: r.w,
    h: r.h,
  });
  const tP = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: p.x - offX,
    y: p.y - offY,
  });

  interface RelRoute {
    exit: Side;
    enter: Side;
    sFieldIdx: number | null;
    dFieldIdx: number | null;
  }
  const fieldRowY = (r: Rect, idx: number) => r.y + 55 + idx * 16;
  const relRoute = new Map<string, RelRoute>();
  for (const rel of diagram.relations) {
    const sr = rects.get(rel.source);
    const dr = rects.get(rel.target);
    if (!sr || !dr) continue;
    const srcEntity = diagram.entities.find((e) => e.id === rel.source);
    const dstEntity = diagram.entities.find((e) => e.id === rel.target);
    const sFieldIdx =
      srcEntity && rel.sourceFieldId
        ? srcEntity.fields.findIndex((f) => f.id === rel.sourceFieldId)
        : -1;
    const dFieldIdx =
      dstEntity && rel.targetFieldId
        ? dstEntity.fields.findIndex((f) => f.id === rel.targetFieldId)
        : -1;
    const [autoExit, autoEnter] = sideBetween(sr, dr);
    const exit: Side =
      sFieldIdx !== -1 || rel.sourceSide
        ? rel.sourceSide === "L"
          ? "left"
          : "right"
        : autoExit;
    const enter: Side =
      dFieldIdx !== -1 || rel.targetSide
        ? rel.targetSide === "R"
          ? "right"
          : "left"
        : autoEnter;
    relRoute.set(rel.id, {
      exit,
      enter,
      sFieldIdx: sFieldIdx !== -1 ? sFieldIdx : null,
      dFieldIdx: dFieldIdx !== -1 ? dFieldIdx : null,
    });
  }

  const srcFan = new Map<string, number>();
  const dstFan = new Map<string, number>();
  for (const rel of diagram.relations) {
    const rt = relRoute.get(rel.id);
    if (!rt) continue;
    if (rt.sFieldIdx === null)
      srcFan.set(
        `${rel.source}|${rt.exit}`,
        (srcFan.get(`${rel.source}|${rt.exit}`) ?? 0) + 1,
      );
    if (rt.dFieldIdx === null)
      dstFan.set(
        `${rel.target}|${rt.enter}`,
        (dstFan.get(`${rel.target}|${rt.enter}`) ?? 0) + 1,
      );
  }

  const edgeParts: string[] = [];
  const labelParts: string[] = [];

  const laneGroups = new Map<string, Relation[]>();
  for (const rel of diagram.relations) {
    const rt = relRoute.get(rel.id);
    if (!rt) continue;
    const key = `${rel.source}|${rt.exit}|${rel.target}|${rt.enter}`;
    laneGroups.set(key, [...(laneGroups.get(key) ?? []), rel]);
  }

  const fanIdx = new Map<string, number>();
  const laneIdx = new Map<string, number>();

  for (const rel of diagram.relations) {
    const sr = rects.get(rel.source);
    const dr = rects.get(rel.target);
    const rt = relRoute.get(rel.id);
    if (!sr || !dr || !rt) continue;
    const { exit, enter, sFieldIdx, dFieldIdx } = rt;

    const srcKey = `${rel.source}|${exit}`;
    const dstKey = `${rel.target}|${enter}`;
    let sIdx = 0;
    let dIdx = 0;
    if (sFieldIdx === null) {
      sIdx = fanIdx.get(srcKey) ?? 0;
      fanIdx.set(srcKey, sIdx + 1);
    }
    if (dFieldIdx === null) {
      dIdx = fanIdx.get(dstKey) ?? 0;
      fanIdx.set(dstKey, dIdx + 1);
    }

    const a =
      sFieldIdx !== null
        ? {
            x: exit === "left" ? sr.x : sr.x + sr.w,
            y: fieldRowY(sr, sFieldIdx),
          }
        : attachPoint(sr, exit, sIdx, srcFan.get(srcKey)!);
    const b =
      dFieldIdx !== null
        ? {
            x: enter === "left" ? dr.x : dr.x + dr.w,
            y: fieldRowY(dr, dFieldIdx),
          }
        : attachPoint(dr, enter, dIdx, dstFan.get(dstKey)!);

    const laneKey = `${rel.source}|${exit}|${rel.target}|${enter}`;
    const group = laneGroups.get(laneKey)!;
    const lIdx = laneIdx.get(laneKey) ?? 0;
    laneIdx.set(laneKey, lIdx + 1);

    const { path, mid, first, last } = route(tP(a), tP(b), exit, lIdx, group.length);

    const midT = { x1: mid.x1, y1: mid.y1, x2: mid.x2, y2: mid.y2 };
    const firstT = { x1: first.x1, y1: first.y1, x2: first.x2, y2: first.y2 };
    const lastT = { x1: last.x1, y1: last.y1, x2: last.x2, y2: last.y2 };

    edgeParts.push(
      `<path d="${path}" fill="none" stroke="${C.muted}" stroke-width="1" marker-end="url(#arrow)"/>`,
    );

    const midHoriz = midT.y1 === midT.y2;
    if (rel.label) {
      if (midHoriz) {
        labelParts.push(
          labelAbove(
            rel.label.toUpperCase(),
            (midT.x1 + midT.x2) / 2,
            midT.y1,
            C.soft,
            C.paper,
          ),
        );
      } else {
        labelParts.push(
          labelRight(
            rel.label.toUpperCase(),
            midT.x1,
            (midT.y1 + midT.y2) / 2,
            C.soft,
            C.paper,
          ),
        );
      }
    }

    const fHoriz = firstT.y1 === firstT.y2;
    if (fHoriz) {
      labelParts.push(
        labelAbove(
          rel.sourceCard,
          (firstT.x1 + firstT.x2) / 2,
          firstT.y1,
          C.muted,
          C.paper,
        ),
      );
    } else {
      const downward = firstT.y2 > firstT.y1;
      labelParts.push(
        labelRight(
          rel.sourceCard,
          firstT.x1,
          (firstT.y1 + firstT.y2) / 2 + (downward ? 14 : 0),
          C.muted,
          C.paper,
        ),
      );
    }

    const lHoriz = lastT.y1 === lastT.y2;
    if (lHoriz) {
      labelParts.push(
        labelAbove(
          rel.targetCard,
          (lastT.x1 + lastT.x2) / 2,
          lastT.y1,
          C.muted,
          C.paper,
        ),
      );
    } else {
      const downward = lastT.y2 > lastT.y1;
      labelParts.push(
        labelRight(
          rel.targetCard,
          lastT.x1,
          (lastT.y1 + lastT.y2) / 2 + (downward ? 14 : 0),
          C.muted,
          C.paper,
        ),
      );
    }
  }

  const nodeParts = diagram.entities.map((e) =>
    entitySvg(e, tr(rects.get(e.id)!), C),
  );

  const legendY = H - 24;
  const legend: string[] = [
    `<line x1="40" y1="${legendY - 44}" x2="${W - 40}" y2="${legendY - 44}" stroke="${C.hairlineSoft}" stroke-width="0.8"/>`,
    `<text x="40" y="${legendY - 28}" fill="${C.muted}" font-size="8" font-family="${MONO}" letter-spacing="0.14em">LEGEND</text>`,
    `<text x="120" y="${legendY - 28}" fill="${C.soft}" font-size="8" font-family="${MONO}"># primary key</text>`,
    `<text x="260" y="${legendY - 28}" fill="${C.soft}" font-size="8" font-family="${MONO}">→ foreign key</text>`,
  ];
  if (diagram.relations.length > 0) {
    legend.push(
      `<text x="400" y="${legendY - 28}" fill="${C.soft}" font-size="8" font-family="${MONO}">1:1 uno a uno</text>`,
    );
    legend.push(
      `<text x="540" y="${legendY - 28}" fill="${C.soft}" font-size="8" font-family="${MONO}">1:N uno a muchos</text>`,
    );
  }
  if (diagram.entities.some((e) => e.focal)) {
    legend.push(
      `<rect x="680" y="${legendY - 36}" width="8" height="8" rx="2" fill="${C.accentTint}" stroke="${C.accent}" stroke-width="1"/>`,
    );
    legend.push(
      `<text x="700" y="${legendY - 28}" fill="${C.soft}" font-size="8" font-family="${MONO}">raíz del dominio</text>`,
    );
  }

  const title = diagram.title || "Modelo entidad-relación";
  const desc = `Modelo entidad-relación con ${diagram.entities.length} entidades y ${diagram.relations.length} relaciones.`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${SANS};
      background: ${C.paper};
      color: ${C.ink};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
    }
    .frame { max-width: 1200px; width: 100%; }
    .eyebrow {
      font-family: ${MONO};
      font-size: 0.66rem;
      font-weight: 500;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${C.muted};
      margin-bottom: 0.5rem;
    }
    h1 {
      font-family: ${SERIF};
      font-size: clamp(1.5rem, 2.4vw + 0.75rem, 2rem);
      font-weight: 400;
      letter-spacing: -0.02em;
      line-height: 1.15;
      color: ${C.ink};
      margin-bottom: 0.5rem;
    }
    .subtitle {
      font-family: ${MONO};
      font-size: 0.75rem;
      color: ${C.muted};
      margin-bottom: 1.5rem;
    }
    svg { width: 100%; min-width: 900px; display: block; }
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">ER / Data Model</p>
    <h1>${esc(title)}</h1>
    <p class="subtitle">${esc(diagram.subtitle)}</p>

    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <title id="diagram-title">${esc(title)}</title>
      <desc id="diagram-desc">${esc(desc)}</desc>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${C.muted}"/></marker>
        <marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${C.accent}"/></marker>
      </defs>

      <rect width="100%" height="100%" fill="${C.paper}"/>

      ${edgeParts.join("\n")}
      ${labelParts.join("\n")}

      ${nodeParts.join("\n")}

      ${legend.join("\n")}
    </svg>
  </div>
</body>
</html>`;
}
