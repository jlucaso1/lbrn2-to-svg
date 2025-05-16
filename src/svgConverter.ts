import type {
  LightBurnProjectFile,
  Lbrn2Shape,
  Lbrn2Rect,
  Lbrn2Ellipse,
  Lbrn2Path,
  Lbrn2XForm,
  Lbrn2CutSetting,
} from "./lbrn2Types";
import { getTransformedBounds } from "./boundsCalculator";
import { parsePathPrimitives } from "./pathDataGenerator";
import { getCutSettingStyle } from "./styleUtils";

const F = (n: number) => n.toFixed(6);

function formatMatrix(xform: Lbrn2XForm): string {
  return `matrix(${F(xform.a)} ${F(-xform.b)} ${F(xform.c)} ${F(-xform.d)} ${F(
    xform.e
  )} ${F(-xform.f)})`;
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
      let el = `<rect x="${F(-rect.W / 2)}" y="${F(-rect.H / 2)}" width="${F(
        rect.W
      )}" height="${F(rect.H)}"`;
      if (rect.Cr > 0) {
        el += ` rx="${F(rect.Cr)}" ry="${F(rect.Cr)}"`;
      }
      el += ` style="${style}" transform="${transform}"/>`;
      return el;
    }
    case "Ellipse": {
      const ellipse = shape as Lbrn2Ellipse;
      if (ellipse.Rx === ellipse.Ry) {
        return `<circle cx="0" cy="0" r="${F(
          ellipse.Rx
        )}" style="${style}" transform="${transform}"/>`;
      } else {
        return `<ellipse cx="0" cy="0" rx="${F(ellipse.Rx)}" ry="${F(
          ellipse.Ry
        )}" style="${style}" transform="${transform}"/>`;
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
    case "Group": {
      if (shape.Type === "Group") {
        const group = shape as import("./lbrn2Types").Lbrn2Group;
        if (!group.Children || !Array.isArray(group.Children)) {
          log.push(`Group shape with no children: ${JSON.stringify(shape)}`);
          return "";
        }
        // If only one child, flatten transform into the child
        if (group.Children.length === 1) {
          const child = { ...group.Children[0] } as Lbrn2Shape;
          // Compose transforms: group.XForm * child.XForm
          if (child.XForm) {
            const g = shape.XForm;
            const c = child.XForm;
            child.XForm = {
              a: g.a * c.a + g.c * c.b,
              b: g.b * c.a + g.d * c.b,
              c: g.a * c.c + g.c * c.d,
              d: g.b * c.c + g.d * c.d,
              e: g.a * c.e + g.c * c.f + g.e,
              f: g.b * c.e + g.d * c.f + g.f,
            };
          } else {
            child.XForm = shape.XForm;
          }
          return shapeToSvgElement(child, cutSettings, log);
        }
        // Otherwise, wrap in <g>
        const groupContent = group.Children.map((child) =>
          shapeToSvgElement(child, cutSettings, log)
        ).join("\n    ");
        return `<g transform="${transform}">\n    ${groupContent}\n</g>`;
      }
    }
    default:
      log.push(`Unsupported shape type: ${(shape as any).Type}`);
      return "";
  }
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
  const svgElements = (shapes as Lbrn2Shape[])
    .map((s) => shapeToSvgElement(s, cutSettings, log))
    .join("\n    ");

  // Compute viewBox to encompass all shapes
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const shape of shapes as Lbrn2Shape[]) {
    const bounds = getTransformedBounds(shape);
    if (bounds) {
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }
  }
  if (
    !isFinite(minX) ||
    !isFinite(minY) ||
    !isFinite(maxX) ||
    !isFinite(maxY)
  ) {
    minX = 0;
    minY = -100;
    maxX = 100;
    maxY = 0;
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
