import type { Lbrn2Shape, Lbrn2XForm } from "./lbrn2Types";

// Compose two transforms
function composeXForms(g: Lbrn2XForm, c: Lbrn2XForm): Lbrn2XForm {
  return {
    a: g.a * c.a + g.c * c.b,
    b: g.b * c.a + g.d * c.b,
    c: g.a * c.c + g.c * c.d,
    d: g.b * c.c + g.d * c.d,
    e: g.a * c.e + g.c * c.f + g.e,
    f: g.b * c.e + g.d * c.f + g.f,
  };
}

// Helper for Bezier extrema
function bezierExtrema(
  p0: { x: number; y: number },
  c0: { x: number; y: number },
  c1: { x: number; y: number },
  p1: { x: number; y: number }
): number[] {
  function getExtrema(a: number, b: number, c: number, d: number): number[] {
    const res: number[] = [];
    const A = -a + 3 * b - 3 * c + d;
    const B = 2 * (a - 2 * b + c);
    const C = b - a;
    if (Math.abs(A) < 1e-8) {
      if (Math.abs(B) > 1e-8) {
        const t = -C / B;
        if (t > 0 && t < 1) res.push(t);
      }
    } else {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const sqrtD = Math.sqrt(disc);
        const t1 = (-B + sqrtD) / (2 * A);
        const t2 = (-B - sqrtD) / (2 * A);
        if (t1 > 0 && t1 < 1) res.push(t1);
        if (t2 > 0 && t2 < 1) res.push(t2);
      }
    }
    return res;
  }
  const tx = getExtrema(p0.x, c0.x, c1.x, p1.x);
  const ty = getExtrema(p0.y, c0.y, c1.y, p1.y);
  return Array.from(new Set([0, 1, ...tx, ...ty]));
}

// Main bounding box calculator
export function getTransformedBounds(
  shape: Lbrn2Shape
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!shape.XForm) return null;
  const xform = shape.XForm;
  function tx(pt: { x: number; y: number }): { x: number; y: number } {
    return {
      x: xform.a * pt.x + xform.c * pt.y + xform.e,
      y: -(xform.b * pt.x + xform.d * pt.y + xform.f),
    };
  }

  let pointsToBound: { x: number; y: number }[] = [];

  if (shape.Type === "Rect") {
    const rect = shape;
    const w = rect.W / 2,
      h = rect.H / 2;
    pointsToBound.push(
      { x: -w, y: -h },
      { x: w, y: -h },
      { x: w, y: h },
      { x: -w, y: h }
    );
  } else if (shape.Type === "Ellipse") {
    const ellipse = shape;
    pointsToBound.push({ x: 0, y: 0 });
    const localPoints = [
      { x: ellipse.Rx, y: 0 },
      { x: -ellipse.Rx, y: 0 },
      { x: 0, y: ellipse.Ry },
      { x: 0, y: -ellipse.Ry },
    ];
    const steps = 32;
    for (let i = 0; i < steps; i++) {
      const theta = (Math.PI * 2 * i) / steps;
      const x = ellipse.Rx * Math.cos(theta);
      const y = ellipse.Ry * Math.sin(theta);
      pointsToBound.push({ x, y });
    }
    pointsToBound.push(...localPoints);
  } else if (shape.Type === "Path") {
    const path = shape;
    if (!path.parsedVerts || !path.PrimList) return null;

    // Use parsedVerts and parsedPrimitives from lbrn2Parser.ts
    // Handle "LineClosed" explicitly as it won't have parsedPrimitives
    if (path.PrimList === "LineClosed") {
      if (path.parsedVerts.length > 0) {
        pointsToBound.push(
          ...path.parsedVerts.filter((v) => v !== null && v !== undefined)
        );
      }
    } else if (path.parsedPrimitives && path.parsedPrimitives.length > 0) {
      for (const prim of path.parsedPrimitives) {
        if (prim.type === "Line") {
          const p0 = path.parsedVerts[prim.startIdx];
          const p1 = path.parsedVerts[prim.endIdx];
          if (p0) pointsToBound.push(p0);
          if (p1) pointsToBound.push(p1);
        } else if (prim.type === "Bezier") {
          const p0 = path.parsedVerts[prim.startIdx];
          const p1 = path.parsedVerts[prim.endIdx];

          if (p0) {
            pointsToBound.push(p0);
            if (p0.c0x !== undefined && p0.c0y !== undefined) {
              pointsToBound.push({ x: p0.c0x, y: p0.c0y });
            }
          }
          if (p1) {
            pointsToBound.push(p1);
            if (p1.c1x !== undefined && p1.c1y !== undefined) {
              pointsToBound.push({ x: p1.c1x, y: p1.c1y });
            }
          }

          // Sample Bezier extrema if all points are valid
          if (
            p0 &&
            p1 &&
            p0.c0x !== undefined &&
            p0.c0y !== undefined &&
            p1.c1x !== undefined &&
            p1.c1y !== undefined
          ) {
            const c0 = { x: p0.c0x, y: p0.c0y };
            const c1 = { x: p1.c1x, y: p1.c1y };
            const ts = bezierExtrema(p0, c0, c1, p1);
            for (const t of ts) {
              const mt = 1 - t;
              const x =
                mt * mt * mt * p0.x +
                3 * mt * mt * t * c0.x +
                3 * mt * t * t * c1.x +
                t * t * t * p1.x;
              const y =
                mt * mt * mt * p0.y +
                3 * mt * mt * t * c0.y +
                3 * mt * t * t * c1.y +
                t * t * t * p1.y;
              pointsToBound.push({ x, y });
            }
          }
        }
      }
    } else if (path.parsedVerts.length > 0) {
      // Fallback: if no primitives but vertices exist (e.g. a list of points not forming lines/curves)
      pointsToBound.push(
        ...path.parsedVerts.filter((v) => v !== null && v !== undefined)
      );
    }
  } else if (shape.Type === "Bitmap") {
    const bitmap = shape;
    const w = bitmap.W / 2,
      h = bitmap.H / 2;
    pointsToBound.push(
      { x: -w, y: -h },
      { x: w, y: -h },
      { x: w, y: h },
      { x: -w, y: h }
    );
  } else if (shape.Type === "Group") {
    const group = shape;
    if (!group.Children || group.Children.length === 0) return null;

    let combinedBounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    } | null = null;
    for (const childShape of group.Children) {
      if (!childShape.XForm || !shape.XForm) continue;
      const effectiveChildXForm = composeXForms(shape.XForm, childShape.XForm);
      const tempRenderableChild = { ...childShape, XForm: effectiveChildXForm };
      const childBounds = getTransformedBounds(tempRenderableChild);
      if (childBounds) {
        if (!combinedBounds) {
          combinedBounds = childBounds;
        } else {
          combinedBounds.minX = Math.min(combinedBounds.minX, childBounds.minX);
          combinedBounds.minY = Math.min(combinedBounds.minY, childBounds.minY);
          combinedBounds.maxX = Math.max(combinedBounds.maxX, childBounds.maxX);
          combinedBounds.maxY = Math.max(combinedBounds.maxY, childBounds.maxY);
        }
      }
    }
    return combinedBounds;
  }

  if (pointsToBound.length === 0) return null;

  const transformedPoints = pointsToBound
    .filter((p) => p !== undefined && p !== null)
    .map(tx);
  if (transformedPoints.length === 0) return null;

  const xs = transformedPoints.map((p) => p.x);
  const ys = transformedPoints.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
