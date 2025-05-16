import type { Lbrn2Path } from "./lbrn2Types";

type PrimToken = { type: string; args: number[] };

const PRIM_LINE = "L";
const PRIM_BEZIER = "B";
const PRIM_QUADRATIC = "Q";
const PRIM_CUBIC = "C";

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
  if (!path.PrimList || !path.parsedVerts || path.parsedVerts.length === 0) {
    log.push(
      `Path ${
        path.PrimList || "PrimList missing"
      } or parsedVerts missing/empty, skipping.`
    );
    return "";
  }
  let d = "";
  let firstMoveToIdx: number | null = null;
  let currentLastIdx: number | null = null;

  const tokens = tokenizePrimList(path.PrimList);

  for (const token of tokens) {
    const primType = token.type;
    const args = token.args;

    if (primType === PRIM_LINE) {
      if (args.length !== 2) {
        log.push(`Line primitive L needs 2 args, got ${args.length}`);
        continue;
      }
      const [idx0, idx1] = args;
      const idx0num = typeof idx0 === "number" ? idx0 : -1;
      const idx1num = typeof idx1 === "number" ? idx1 : -1;
      if (idx0num < 0 || idx1num < 0) {
        log.push(`Invalid indices for L: ${idx0}, ${idx1}`);
        continue;
      }
      const p0 = path.parsedVerts[idx0num];
      const p1 = path.parsedVerts[idx1num];
      if (!p0 || !p1) {
        log.push(`Invalid vertex index for L ${idx0} ${idx1}`);
        continue;
      }

      if (firstMoveToIdx === null) {
        d += `M${F(p0.x)},${F(p0.y)}`;
        firstMoveToIdx = idx0num;
      } else if (currentLastIdx !== idx0num) {
        d += ` M${F(p0.x)},${F(p0.y)}`;
      }
      d += ` L${F(p1.x)},${F(p1.y)}`;
      currentLastIdx = idx1num;
    } else if (primType === PRIM_BEZIER) {
      if (args.length !== 2) {
        log.push(`Bezier primitive B needs 2 args, got ${args.length}`);
        continue;
      }
      const [idx0, idx1] = args;
      const idx0numB = typeof idx0 === "number" ? idx0 : -1;
      const idx1numB = typeof idx1 === "number" ? idx1 : -1;
      if (idx0numB < 0 || idx1numB < 0) {
        log.push(`Invalid indices for B: ${idx0}, ${idx1}`);
        continue;
      }
      const p0 = path.parsedVerts[idx0numB];
      const p1 = path.parsedVerts[idx1numB];

      if (!p0 || !p1) {
        log.push(`Invalid vertex index for B ${idx0} ${idx1}`);
        continue;
      }
      if (
        p0.c0x === undefined ||
        p0.c0y === undefined ||
        p1.c1x === undefined ||
        p1.c1y === undefined
      ) {
        log.push(
          `Bezier primitive B ${idx0} ${idx1} missing control points. P0: ${JSON.stringify(
            p0
          )}, P1: ${JSON.stringify(p1)}. Falling back to Line.`
        );
        if (firstMoveToIdx === null) {
          d += `M${F(p0.x)},${F(p0.y)}`;
          firstMoveToIdx = idx0numB;
        } else if (currentLastIdx !== idx0numB) {
          d += ` M${F(p0.x)},${F(p0.y)}`;
        }
        d += ` L${F(p1.x)},${F(p1.y)}`;
        currentLastIdx = idx1numB;
        continue;
      }

      if (firstMoveToIdx === null) {
        d += `M${F(p0.x)},${F(p0.y)}`;
        firstMoveToIdx = idx0numB;
      } else if (currentLastIdx !== idx0numB) {
        d += ` M${F(p0.x)},${F(p0.y)}`;
      }
      d += ` C${F(p0.c0x)},${F(p0.c0y)} ${F(p1.c1x)},${F(p1.c1y)} ${F(
        p1.x
      )},${F(p1.y)}`;
      currentLastIdx = idx1numB;
    } else if (primType === PRIM_QUADRATIC) {
      if (args.length !== 2 && args.length !== 3) {
        log.push(`Quadratic Bezier Q needs 2 or 3 args, got ${args.length}`);
        continue;
      }
      log.push(
        `Quadratic Bezier Q primitive not fully implemented. Args: ${args.join(
          ","
        )}`
      );
    } else if (primType === PRIM_CUBIC) {
      if (args.length !== 3 && args.length !== 4) {
        log.push(`Cubic Bezier C needs 3 or 4 args, got ${args.length}`);
        continue;
      }
      log.push(
        `Cubic Bezier C primitive (distinct from B) not fully implemented. Args: ${args.join(
          ","
        )}`
      );
    } else {
      log.push(
        `Unknown or unsupported path primitive: ${primType} with args [${args.join(
          ", "
        )}]`
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
