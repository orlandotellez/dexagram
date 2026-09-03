import type { Diagram, Entity, Field, Relation, Side } from "./model";
import { uid } from "./model";

interface XY {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const num = (v: string | null | undefined): number => {
  const n = parseFloat(v ?? "");
  return isFinite(n) ? n : 0;
};

function pathEnds(d: string): { start: XY; end: XY } {
  const m = /M\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/.exec(d);
  const start = { x: num(m?.[1]), y: num(m?.[2]) };
  let x = start.x;
  let y = start.y;
  const rest = m ? d.slice(m[0].length) : d;
  const tokens = rest.match(/([HhVvLlQqCcSsTt])|(-?[\d.]+)/g) ?? [];
  let cmd = "";
  const args: number[] = [];
  const apply = () => {
    if (!cmd) return;
    if (cmd === "H") x = args[0];
    else if (cmd === "h") x += args[0];
    else if (cmd === "V") y = args[0];
    else if (cmd === "v") y += args[0];
    else if (cmd === "L" || cmd === "T") {
      x = args[0];
      y = args[1];
    } else if (cmd === "l" || cmd === "t") {
      x += args[0];
      y += args[1];
    } else if (cmd === "Q" || cmd === "S") {
      x = args[2];
      y = args[3];
    } else if (cmd === "q" || cmd === "s") {
      x += args[2];
      y += args[3];
    } else if (cmd === "C") {
      x = args[4];
      y = args[5];
    } else if (cmd === "c") {
      x += args[4];
      y += args[5];
    }
    args.length = 0;
  };
  for (const t of tokens) {
    if (/[HhVvLlQqCcSsTt]/.test(t)) {
      apply();
      cmd = t;
    } else {
      args.push(num(t));
    }
  }
  apply();
  return { start, end: { x, y } };
}

function sideOfPoint(b: Box, p: XY): Side | "T" | "B" | undefined {
  const eps = 2;
  const onY = p.y >= b.y - eps && p.y <= b.y + b.h + eps;
  if (Math.abs(p.x - b.x) <= eps && onY) return "L";
  if (Math.abs(p.x - (b.x + b.w)) <= eps && onY) return "R";
  if (
    Math.abs(p.y - b.y) <= eps &&
    p.x >= b.x - eps &&
    p.x <= b.x + b.w + eps
  )
    return "T";
  if (
    Math.abs(p.y - (b.y + b.h)) <= eps &&
    p.x >= b.x - eps &&
    p.x <= b.x + b.w + eps
  )
    return "B";
  return undefined;
}

function pathBBox(
  d: string,
  start: XY,
  end: XY,
): { x1: number; y1: number; x2: number; y2: number } {
  const xs = [start.x, end.x];
  const ys = [start.y, end.y];
  for (const m of d.matchAll(/-?[\d.]+/g)) {
    const v = num(m[0]);
    if (xs.length <= ys.length) xs.push(v);
    else ys.push(v);
  }
  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

function dist(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function parseErHtml(html: string): Diagram {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("No se encontró un SVG en el archivo");

  const texts = Array.from(svg.querySelectorAll("text"));

  const rects = Array.from(svg.querySelectorAll("rect"))
    .map((r) => ({
      x: num(r.getAttribute("x")),
      y: num(r.getAttribute("y")),
      w: num(r.getAttribute("width")),
      h: num(r.getAttribute("height")),
      stroke: r.getAttribute("stroke") ?? "",
      fill: r.getAttribute("fill") ?? "",
    }))
    .filter((r) => r.w >= 150 && r.h >= 40 && r.w < 1000);

  const seen = new Map<string, (typeof rects)[number]>();
  for (const r of rects) {
    seen.set(
      `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`,
      r,
    );
  }

  const entities: Entity[] = [];
  const boxByEntity = new Map<string, Box>();
  for (const b of seen.values()) {
    const id = uid();
    const focal =
      /#cb5bce/i.test(b.stroke) || /cb5bce|203,\s*91,\s*206/i.test(b.fill);
    const inner = texts.filter((t) => {
      const tx = num(t.getAttribute("x"));
      const ty = num(t.getAttribute("y"));
      return tx >= b.x && tx <= b.x + b.w && ty >= b.y && ty <= b.y + b.h;
    });
    const name =
      inner.find((t) => t.getAttribute("font-size") === "12")?.textContent
        ?.trim() ?? `Entidad ${entities.length + 1}`;
    const table =
      inner
        .find(
          (t) =>
            t.getAttribute("font-size") === "9" &&
            t.getAttribute("text-anchor") === "middle",
        )
        ?.textContent?.trim() ?? "";
    const fieldEls = inner
      .filter(
        (t) =>
          t.getAttribute("font-size") === "9" &&
          t.getAttribute("text-anchor") !== "middle",
      )
      .sort(
        (a, z) => num(a.getAttribute("y")) - num(z.getAttribute("y")),
      );
    const fields: Field[] = fieldEls.map((t) => {
      const raw = t.textContent ?? "";
      const isPk = raw.startsWith("# ");
      const isFk =
        raw.startsWith("→ ") || raw.startsWith("\u2192 ");
      return {
        id: uid(),
        name: raw
          .replace(/^#\s*/, "")
          .replace(/^→\s*/, "")
          .replace(/^\u2192\s*/, "")
          .trim() || "campo",
        isPk,
        isFk,
      };
    });
    entities.push({ id, name, table, focal, x: b.x, y: b.y, fields });
    boxByEntity.set(id, { x: b.x, y: b.y, w: b.w, h: b.h });
  }

  if (entities.length === 0)
    throw new Error("No se encontraron entidades en el archivo");

  interface Label {
    x: number;
    y: number;
    text: string;
    isRel: boolean;
  }
  const labels: Label[] = texts
    .filter((t) => t.getAttribute("font-size") === "8")
    .map((t) => ({
      x: num(t.getAttribute("x")),
      y: num(t.getAttribute("y")),
      text: (t.textContent ?? "").trim(),
      isRel: !!t.getAttribute("letter-spacing"),
    }));

  const relations: Relation[] = [];
  const paths = Array.from(svg.querySelectorAll("path")).filter((p) =>
    (p.getAttribute("marker-end") ?? "").includes("arrow"),
  );

  const snapField = (
    entity: Entity,
    b: Box,
    p: XY,
  ): string | undefined => {
    if (sideOfPoint(b, p) !== "L" && sideOfPoint(b, p) !== "R")
      return undefined;
    for (let i = 0; i < entity.fields.length; i++) {
      if (Math.abs(p.y - (b.y + 55 + i * 16)) <= 4)
        return entity.fields[i].id;
    }
    return undefined;
  };

  for (const p of paths) {
    const d = p.getAttribute("d") ?? "";
    const { start, end } = pathEnds(d);
    const src = entities.find((e) => {
      const b = boxByEntity.get(e.id)!;
      return !!sideOfPoint(b, start);
    });
    const dst = entities.find((e) => {
      const b = boxByEntity.get(e.id)!;
      return !!sideOfPoint(b, end);
    });
    if (!src || !dst || src.id === dst.id) continue;

    const sb = boxByEntity.get(src.id)!;
    const db = boxByEntity.get(dst.id)!;
    const sSide = sideOfPoint(sb, start);
    const dSide = sideOfPoint(db, end);

    const bb = pathBBox(d, start, end);
    const near = labels.filter(
      (l) =>
        l.x >= bb.x1 - 40 &&
        l.x <= bb.x2 + 40 &&
        l.y >= bb.y1 - 40 &&
        l.y <= bb.y2 + 40,
    );
    const relLabel = near.find((l) => l.isRel)?.text ?? "";
    const cards = near.filter((l) => !l.isRel && l.text !== relLabel);
    const srcCard =
      cards.length > 0
        ? [...cards].sort((a, z) => dist(a, start) - dist(z, start))[0]
        : null;
    const dstCard =
      cards.filter((c) => c !== srcCard).length > 0
        ? [...cards.filter((c) => c !== srcCard)].sort(
            (a, z) => dist(a, end) - dist(z, end),
          )[0]
        : null;

    relations.push({
      id: uid(),
      source: src.id,
      target: dst.id,
      sourceCard: srcCard?.text || "1",
      targetCard: dstCard?.text || "N",
      label: relLabel,
      sourceFieldId: snapField(src, sb, start),
      targetFieldId: snapField(dst, db, end),
      sourceSide:
        sSide === "L" || sSide === "R" ? sSide : undefined,
      targetSide:
        dSide === "L" || dSide === "R" ? dSide : undefined,
    });
  }

  return {
    title: doc.querySelector("h1")?.textContent?.trim() ?? "",
    subtitle:
      doc.querySelector(".subtitle")?.textContent?.trim() ?? "",
    entities,
    relations,
  };
}
