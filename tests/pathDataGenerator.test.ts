import { describe, test, expect } from "bun:test";
import { tokenizePrimList, parsePathPrimitives } from "../src/pathDataGenerator";

describe("tokenizePrimList", () => {
  test("returns empty array for empty string", () => {
    expect(tokenizePrimList("")).toEqual([]);
  });

  test("ignores invalid tokens and whitespace", () => {
    expect(tokenizePrimList(" 1 2 3 !@# ")).toEqual([]);
  });

  test("parses max 4 args per token", () => {
    expect(tokenizePrimList("L1 2 3 4 5 6")).toEqual([
      { type: "L", args: [1, 2, 3, 4] },
    ]);
  });

  test("handles mixed whitespace", () => {
    expect(tokenizePrimList("L  1\t2\n3 4")).toEqual([
      { type: "L", args: [1, 2, 3, 4] },
    ]);
  });
});

describe("parsePathPrimitives", () => {
  test("handles LineClosed with 0 vertices", () => {
    const log: string[] = [];
    const path: any = { PrimList: "LineClosed", parsedVerts: [] };
    expect(parsePathPrimitives(path, log)).toBe("");
    expect(log[0]).toMatch(/missing\/empty/);
  });

  test("handles LineClosed with 1 vertex", () => {
    const log: string[] = [];
    const path: any = { PrimList: "LineClosed", parsedVerts: [{ x: 1, y: 2 }] };
    expect(parsePathPrimitives(path, log)).toBe("M1.000000,2.000000Z");
  });

  test("handles LineClosed with nullish first vertex", () => {
    const log: string[] = [];
    const path: any = { PrimList: "LineClosed", parsedVerts: [null, { x: 2, y: 3 }] };
    expect(parsePathPrimitives(path, log)).toBe("");
    expect(log[0]).toMatch(/nullish first vertex/);
  });

  test("skips if parsedVerts or parsedPrimitives missing", () => {
    const log: string[] = [];
    const minimalPath = {
      PrimList: "X",
      Type: "Path",
      VertList: "",
      CutIndex: 0,
      XFormVal: "",
    };
    expect(parsePathPrimitives(minimalPath as any, log)).toBe("");
    expect(log[0]).toMatch(/missing\/empty/);
  });

  test("handles Line with invalid indices", () => {
    const log: string[] = [];
    const path: any = {
      parsedVerts: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      parsedPrimitives: [{ type: "Line", startIdx: -1, endIdx: 1 }],
    };
    expect(parsePathPrimitives(path, log)).toBe("");
    expect(log[0]).toMatch(/Invalid indices/);
  });

  test("handles Line with invalid vertex index", () => {
    const log: string[] = [];
    const path: any = {
      parsedVerts: [{ x: 0, y: 0 }],
      parsedPrimitives: [{ type: "Line", startIdx: 0, endIdx: 1 }],
    };
    expect(parsePathPrimitives(path, log)).toBe("");
    expect(log[0]).toMatch(/Invalid vertex index/);
  });

  test("handles Bezier with missing control points (fallback to Line)", () => {
    const log: string[] = [];
    const path: any = {
      parsedVerts: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      parsedPrimitives: [{ type: "Bezier", startIdx: 0, endIdx: 1 }],
    };
    const d = parsePathPrimitives(path, log);
    expect(d).toContain("M0.000000,0.000000 L1.000000,1.000000");
    expect(log[0]).toMatch(/missing control points/);
  });

  test("handles unknown primitive type", () => {
    const log: string[] = [];
    const path: any = {
      parsedVerts: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      parsedPrimitives: [{ type: "Unknown", startIdx: 0, endIdx: 1 }],
    };
    parsePathPrimitives(path, log);
    expect(log[0]).toMatch(/Unknown or unsupported/);
  });
});