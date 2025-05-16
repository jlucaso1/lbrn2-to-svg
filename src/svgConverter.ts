import type { LightBurnProjectFile, Lbrn2Shape, Lbrn2Rect, Lbrn2Ellipse, Lbrn2Path, Lbrn2XForm, Lbrn2Vec2, Lbrn2CutSetting } from './lbrn2Types';

const F = (n: number) => n.toFixed(6);

// Default color palette for layers if CutSetting has no color
const DEFAULT_COLORS = [
  "#000000", "#FF0000", "#00AA00", "#0000FF", "#FF9900", "#9900FF", "#00AAAA", "#AAAA00"
];

function formatMatrix(xform: Lbrn2XForm): string {
  return `matrix(${F(xform.a)} ${F(-xform.b)} ${F(xform.c)} ${F(-xform.d)} ${F(xform.e)} ${F(-xform.f)})`;
}

function getCutSettingStyle(cutIndex: number, cutSettings: Lbrn2CutSetting[] | undefined): string {
  if (!cutSettings || cutSettings.length === 0) {
    return `stroke:#000000;stroke-width:0.050000mm;fill:none`;
  }
  const cs = cutSettings.find(cs => cs.index === cutIndex);
  let color = "#000000";
  if (cs && (cs as any).color) {
    color = (cs as any).color;
  } else if (cs) {
    const paletteIdx = typeof cs.index === "number" && cs.index >= 0 ? cs.index % DEFAULT_COLORS.length : 0;
    color = DEFAULT_COLORS[paletteIdx] || "#000000";
  }
  return `stroke:${color};stroke-width:0.050000mm;fill:none`;
}

function parsePathPrimitives(path: Lbrn2Path, log: string[]): string {
  if (!path.PrimList || !path.parsedVerts) return "";
  let d = "";
  // Match all primitives (L, Q, C, etc.)
  const primRegex = /([A-Z])\s*([\d\s\-\.]+)/g;
  let match: RegExpExecArray | null;
  let subpathStarted = false;
  while ((match = primRegex.exec(path.PrimList)) !== null) {
    const primType = match[1];
    const args = match[2]?.trim().split(/\s+/).map(Number) ?? [];
    if (primType === "L" && args.length === 2) {
      const [idx0, idx1] = args;
      const p0 = path.parsedVerts && typeof idx0 === "number" ? path.parsedVerts[idx0] : undefined;
      const p1 = path.parsedVerts && typeof idx1 === "number" ? path.parsedVerts[idx1] : undefined;
      if (p0 && p1) {
        if (!subpathStarted) {
          d += `M${F(p0.x)},${F(p0.y)} L${F(p1.x)},${F(p1.y)}`;
          subpathStarted = true;
        } else {
          d += ` L${F(p1.x)},${F(p1.y)}`;
        }
      }
    } else if (primType === "Q" && args.length === 3) {
      // Quadratic Bezier: Q <ctrlIdx> <toIdx>
      const [ctrlIdx, toIdx, fromIdx] = args;
      const p0 = path.parsedVerts && typeof fromIdx === "number" ? path.parsedVerts[fromIdx] : undefined;
      const pc = path.parsedVerts && typeof ctrlIdx === "number" ? path.parsedVerts[ctrlIdx] : undefined;
      const p1 = path.parsedVerts && typeof toIdx === "number" ? path.parsedVerts[toIdx] : undefined;
      if (p0 && pc && p1) {
        if (!subpathStarted) {
          d += `M${F(p0.x)},${F(p0.y)} Q${F(pc.x)},${F(pc.y)} ${F(p1.x)},${F(p1.y)}`;
          subpathStarted = true;
        } else {
          d += ` Q${F(pc.x)},${F(pc.y)} ${F(p1.x)},${F(p1.y)}`;
        }
      }
    } else if (primType === "C" && args.length === 4) {
      // Cubic Bezier: C <ctrl1Idx> <ctrl2Idx> <toIdx>
      const [ctrl1Idx, ctrl2Idx, toIdx, fromIdx] = args;
      const p0 = path.parsedVerts && typeof fromIdx === "number" ? path.parsedVerts[fromIdx] : undefined;
      const pc1 = path.parsedVerts && typeof ctrl1Idx === "number" ? path.parsedVerts[ctrl1Idx] : undefined;
      const pc2 = path.parsedVerts && typeof ctrl2Idx === "number" ? path.parsedVerts[ctrl2Idx] : undefined;
      const p1 = path.parsedVerts && typeof toIdx === "number" ? path.parsedVerts[toIdx] : undefined;
      if (p0 && pc1 && pc2 && p1) {
        if (!subpathStarted) {
          d += `M${F(p0.x)},${F(p0.y)} C${F(pc1.x)},${F(pc1.y)} ${F(pc2.x)},${F(pc2.y)} ${F(p1.x)},${F(p1.y)}`;
          subpathStarted = true;
        } else {
          d += ` C${F(pc1.x)},${F(pc1.y)} ${F(pc2.x)},${F(pc2.y)} ${F(p1.x)},${F(p1.y)}`;
        }
      }
    } else {
      log.push(`Unknown or unsupported path primitive: ${primType} with args [${args.join(", ")}]`);
    }
  }
  return d;
}

function shapeToSvgElement(
  shape: Lbrn2Shape,
  cutSettings: Lbrn2CutSetting[] | undefined,
  log: string[]
): string {
  if (!shape.XForm) {
    log.push(`Shape missing parsed XForm, skipping: ${JSON.stringify(shape)}`);
    return "";
  }
  const transform = formatMatrix(shape.XForm);
  const style = getCutSettingStyle(shape.CutIndex, cutSettings);

  switch (shape.Type) {
    case "Rect": {
      const rect = shape as Lbrn2Rect;
      let el = `<rect x="${F(-rect.W / 2)}" y="${F(-rect.H / 2)}" width="${F(rect.W)}" height="${F(rect.H)}"`;
      if (rect.Cr > 0) {
        el += ` rx="${F(rect.Cr)}" ry="${F(rect.Cr)}"`;
      }
      el += ` style="${style}" transform="${transform}"/>`;
      return el;
    }
    case "Ellipse": {
      const ellipse = shape as Lbrn2Ellipse;
      if (ellipse.Rx === ellipse.Ry) {
        return `<circle cx="0" cy="0" r="${F(ellipse.Rx)}" style="${style}" transform="${transform}"/>`;
      } else {
        return `<ellipse cx="0" cy="0" rx="${F(ellipse.Rx)}" ry="${F(ellipse.Ry)}" style="${style}" transform="${transform}"/>`;
      }
    }
    case "Path": {
      const path = shape as Lbrn2Path;
      if (!path.parsedVerts || path.parsedVerts.length === 0) {
        log.push(`Path shape with no vertices: ${JSON.stringify(shape)}`);
        return "";
      }
      const d = parsePathPrimitives(path, log);
      if (d) {
        return `<path d="${d}" style="${style}" transform="${transform}"/>`;
      }
      log.push(`Path shape with no valid primitives: ${JSON.stringify(shape)}`);
      return "";
    }
    default:
      log.push(`Unsupported shape type: ${(shape as any).Type}`);
      return "";
  }
}

function getTransformedBounds(shape: Lbrn2Shape): { minX: number, minY: number, maxX: number, maxY: number } | null {
  if (!shape.XForm) return null;
  const xform = shape.XForm;
  function tx(pt: Lbrn2Vec2): { x: number, y: number } {
    return {
      x: xform.a * pt.x + xform.c * pt.y + xform.e,
      y: -(xform.b * pt.x + xform.d * pt.y + xform.f)
    };
  }
  if (shape.Type === "Rect") {
    const rect = shape as Lbrn2Rect;
    const w = rect.W / 2, h = rect.H / 2;
    const corners = [
      tx({ x: -w, y: -h }),
      tx({ x: w, y: -h }),
      tx({ x: w, y: h }),
      tx({ x: -w, y: h })
    ];
    const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  } else if (shape.Type === "Ellipse") {
    const ellipse = shape as Lbrn2Ellipse;
    // Approximate bounds by transforming 4 cardinal points
    const pts = [
      tx({ x: ellipse.Rx, y: 0 }),
      tx({ x: -ellipse.Rx, y: 0 }),
      tx({ x: 0, y: ellipse.Ry }),
      tx({ x: 0, y: -ellipse.Ry })
    ];
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  } else if (shape.Type === "Path") {
    const path = shape as Lbrn2Path;
    if (!path.parsedVerts) return null;
    const pts = path.parsedVerts.map(tx);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  return null;
}

export function lbrn2ToSvg(project: LightBurnProjectFile): string {
  let shapes = project.LightBurnProject.Shape || [];
  if (!Array.isArray(shapes)) {
    if (shapes && (shapes as Lbrn2Shape).Type) {
      shapes = [shapes as Lbrn2Shape];
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100"><text>No shapes found</text></svg>`;
    }
  }
  if (shapes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100"><text>No shapes found</text></svg>`;
  }

  const cutSettings = Array.isArray(project.LightBurnProject.CutSetting)
    ? project.LightBurnProject.CutSetting
    : project.LightBurnProject.CutSetting
      ? [project.LightBurnProject.CutSetting]
      : [];

  const log: string[] = [];
  const svgElements = (shapes as Lbrn2Shape[]).map(s => shapeToSvgElement(s, cutSettings, log)).join('\n    ');

  // Compute viewBox to encompass all shapes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of shapes as Lbrn2Shape[]) {
    const bounds = getTransformedBounds(shape);
    if (bounds) {
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    minX = 0; minY = -100; maxX = 100; maxY = 0;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const svgWidth = `${F(w)}mm`;
  const svgHeight = `${F(h)}mm`;
  const viewBox = `${F(minX)} ${F(minY)} ${F(w)} ${F(h)}`;

  if (log.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("SVG Conversion Warnings:", log);
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgWidth}" height="${svgHeight}" viewBox="${viewBox}">
    ${svgElements}
</svg>`;
}