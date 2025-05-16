import type { Lbrn2Path } from "./lbrn2Types";

type PrimToken = { type: string; args: number[] };

const F = (n: number) => n.toFixed(6);

export function tokenizePrimList(primList: string): PrimToken[] {
  const tokens: PrimToken[] = [];
  let i = 0;
  const len = primList.length;

  function parseNextInt(): number | null {
    while (i < len && /\s/.test(primList[i] ?? "")) i++;
    let numStr = "";
    while (i < len && /[0-9]/.test(primList[i] ?? "")) {
      numStr += primList[i];
      i++;
    }
    return numStr.length > 0 ? Number(numStr) : null;
  }

  while (i < len) {
    while (i < len && /\s/.test(primList[i] ?? "")) i++;
    if (i >= len) break;
    const type = primList[i];
    if (type === undefined || !/[A-Za-z]/.test(type)) {
      i++;
      continue;
    }
    i++;
    const args: number[] = [];
    for (let argCount = 0; argCount < 4; argCount++) {
      const num = parseNextInt();
      if (num !== null) {
        args.push(num);
      } else {
        break;
      }
    }
    if (type !== undefined) {
      tokens.push({ type, args });
    }
  }
  return tokens;
}

export function parsePathPrimitives(path: Lbrn2Path, log: string[]): string {
  // Handle LineClosed explicitly
  if (
    path.PrimList === "LineClosed" &&
    path.parsedVerts &&
    path.parsedVerts.length > 0
  ) {
    const verts = path.parsedVerts;
    if (verts.length < 1) {
      log.push(
        `Path with 'LineClosed' has 0 vertices, skipping: ${JSON.stringify(
          path
        )}`
      );
      return "";
    }
    if (verts.length === 1 && verts[0]) {
      return `M${F(verts[0].x)},${F(verts[0].y)}Z`;
    }
    if (verts.length > 0 && !verts[0]) {
      log.push(
        `Path with 'LineClosed' has nullish first vertex, skipping: ${JSON.stringify(
          path
        )}`
      );
      return "";
    }
    let d = `M${F(verts[0]!.x)},${F(verts[0]!.y)}`;
    for (let i = 1; i < verts.length; i++) {
      if (verts[i]) {
        d += ` L${F(verts[i]!.x)},${F(verts[i]!.y)}`;
      } else {
        log.push(
          `Path with 'LineClosed' encountered a nullish vertex at index ${i}, stopping line generation for this path.`
        );
        break;
      }
    }
    d += "Z";
    return d;
  }

  // Existing logic for explicit primitives
  if (
    !path.parsedPrimitives ||
    !path.parsedVerts ||
    path.parsedVerts.length === 0
  ) {
    log.push(
      `Path ${
        path.PrimList || "PrimList missing"
      } or parsedVerts/parsedPrimitives missing/empty, skipping.`
    );
    return "";
  }
  let d = "";
  let firstMoveToIdx: number | null = null;
  let currentLastIdx: number | null = null;

  for (const prim of path.parsedPrimitives) {
    if (prim.type === "Line") {
      const idx0 = prim.startIdx;
      const idx1 = prim.endIdx;
      if (idx0 < 0 || idx1 < 0) {
        log.push(`Invalid indices for Line: ${idx0}, ${idx1}`);
        continue;
      }
      const p0 = path.parsedVerts[idx0];
      const p1 = path.parsedVerts[idx1];
      if (!p0 || !p1) {
        log.push(`Invalid vertex index for Line ${idx0} ${idx1}`);
        continue;
      }

      if (firstMoveToIdx === null) {
        d += `M${F(p0.x)},${F(p0.y)}`;
        firstMoveToIdx = idx0;
      } else if (currentLastIdx !== idx0) {
        d += ` M${F(p0.x)},${F(p0.y)}`;
      }
      d += ` L${F(p1.x)},${F(p1.y)}`;
      currentLastIdx = idx1;
    } else if (prim.type === "Bezier") {
      const idx0 = prim.startIdx;
      const idx1 = prim.endIdx;
      if (idx0 < 0 || idx1 < 0) {
        log.push(`Invalid indices for Bezier: ${idx0}, ${idx1}`);
        continue;
      }
      const p0 = path.parsedVerts[idx0];
      const p1 = path.parsedVerts[idx1];

      if (!p0 || !p1) {
        log.push(`Invalid vertex index for Bezier ${idx0} ${idx1}`);
        continue;
      }
      if (
        p0.c0x === undefined ||
        p0.c0y === undefined ||
        p1.c1x === undefined ||
        p1.c1y === undefined
      ) {
        log.push(
          `Bezier primitive ${idx0} ${idx1} missing control points. P0: ${JSON.stringify(
            p0
          )}, P1: ${JSON.stringify(p1)}. Falling back to Line.`
        );
        if (firstMoveToIdx === null) {
          d += `M${F(p0.x)},${F(p0.y)}`;
          firstMoveToIdx = idx0;
        } else if (currentLastIdx !== idx0) {
          d += ` M${F(p0.x)},${F(p0.y)}`;
        }
        d += ` L${F(p1.x)},${F(p1.y)}`;
        currentLastIdx = idx1;
        continue;
      }

      if (firstMoveToIdx === null) {
        d += `M${F(p0.x)},${F(p0.y)}`;
        firstMoveToIdx = idx0;
      } else if (currentLastIdx !== idx0) {
        d += ` M${F(p0.x)},${F(p0.y)}`;
      }
      d += ` C${F(p0.c0x)},${F(p0.c0y)} ${F(p1.c1x)},${F(p1.c1y)} ${F(
        p1.x
      )},${F(p1.y)}`;
      currentLastIdx = idx1;
    } else {
      log.push(
        `Unknown or unsupported path primitive type: ${
          (prim as any).type ?? "unknown"
        }`
      );
    }
  }
  if (
    firstMoveToIdx !== null &&
    currentLastIdx === firstMoveToIdx &&
    d !== ""
  ) {
    d += "Z";
  }
  return d;
}
