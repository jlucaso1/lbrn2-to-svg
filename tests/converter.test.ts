import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { parseLbrn2 } from '../src/lbrn2Parser';
import { lbrn2ToSvg } from '../src/svgConverter';

const artifactsDir = path.join(import.meta.dir, 'artifacts');

import { XMLParser } from 'fast-xml-parser';

// Helper to compare SVGs structurally (ignoring attribute order and formatting)
function structurallyEqualSvg(svgA: string, svgB: string): boolean {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  function normalizeValue(val: any, key?: string): any {
    // Normalize numbers: "5.000000" -> "5", "10.000mm" -> "10mm"
    if (typeof val === "number") {
      return Number(val.toFixed(6)).toString().replace(/\.0+$/, "");
    }
    if (typeof val === "string") {
      // Numeric string: "5.000000" -> "5"
      if (/^-?\d+(\.\d+)?$/.test(val.trim())) {
        return Number(Number(val).toFixed(6)).toString().replace(/\.0+$/, "");
      }
      // Numeric with unit: "10.000000mm" -> "10mm"
      if (/^-?\d+(\.\d+)?[a-zA-Z%]+$/.test(val.trim())) {
        return val.replace(
          /^(-?\d+)(\.\d+)?([a-zA-Z%]+)$/,
          (_, int, dec, unit) =>
            (dec ? Number(int + dec).toString().replace(/\.0+$/, "") : int) + unit
        );
      }
      // Normalize transform: remove spaces, unify delimiters, normalize numbers
      if (key === "transform") {
        return val
          .replace(/\s*,\s*/g, ",")
          .replace(/\s+/g, ",")
          .replace(/-?\d+(\.\d+)?/g, (num) =>
            Number(Number(num).toFixed(6)).toString().replace(/\.0+$/, "")
          );
      }
      // Normalize style: remove extra spaces, sort properties, normalize numbers, ignore stroke-width
      if (key === "style") {
        return val
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((prop) => !prop.startsWith("stroke-width"))
          .map((prop) =>
            prop.replace(/-?\d+(\.\d+)?/g, (num) =>
              Number(Number(num).toFixed(6)).toString().replace(/\.0+$/, "")
            )
          )
          .sort()
          .join(";");
      }
      // Normalize path d attribute: remove unnecessary zeros and spaces
      if (key === "d") {
        return val
          .replace(/(\d+)\.0+\b/g, "$1")
          .replace(/(\d+\.\d*?[1-9])0+\b/g, "$1")
          .replace(/(\d)\.0+(?=[^0-9])/g, "$1")
          .replace(/(\d)\.0+(?=\s|,|$)/g, "$1")
          .replace(/\s+/g, " ")
          .replace(/ ?([ML]) ?/g, "$1");
      }
    }
    return val;
  }

  function normalizeAttrs(obj: any, parentKey?: string): any {
    if (typeof obj !== "object" || obj === null) return normalizeValue(obj, parentKey);
    if (Array.isArray(obj)) return obj.map((v) => normalizeAttrs(v, parentKey));
    const sorted: any = {};
    Object.keys(obj)
      .filter(
        (k) =>
          !["width", "height", "viewBox"].includes(k) // Ignore canvas attributes for geometry-only comparison
      )
      .sort()
      .forEach((k) => {
        sorted[k] = normalizeAttrs(obj[k], k);
      });
    return sorted;
  }

  // Remove whitespace between tags and parse
  const objA = normalizeAttrs(parser.parse(svgA.replace(/>\s+</g, '><')));
  const objB = normalizeAttrs(parser.parse(svgB.replace(/>\s+</g, '><')));
  return JSON.stringify(objA) === JSON.stringify(objB);
}

describe('LBRN2 to SVG Converter', () => {
  const testCases = [
    { name: 'circle', lbrn2File: 'circle.lbrn2', svgFile: 'circle.svg' },
    { name: 'square', lbrn2File: 'square.lbrn2', svgFile: 'square.svg' },
    { name: 'line', lbrn2File: 'line.lbrn2', svgFile: 'line.svg' },
  ];

  for (const tc of testCases) {
    test(`should convert ${tc.name}.lbrn2 to ${tc.name}.svg`, () => {
      const lbrn2Path = path.join(artifactsDir, tc.lbrn2File);
      const expectedSvgPath = path.join(artifactsDir, tc.svgFile);

      const lbrn2Content = fs.readFileSync(lbrn2Path, 'utf-8');
      const expectedSvgContent = fs.readFileSync(expectedSvgPath, 'utf-8');

      const parsedLbrn2 = parseLbrn2(lbrn2Content);
      const generatedSvg = lbrn2ToSvg(parsedLbrn2);

      if (!structurallyEqualSvg(generatedSvg, expectedSvgContent)) {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "",
          parseTagValue: false,
          parseAttributeValue: false,
          trimValues: true,
        });
        const objA = parser.parse(generatedSvg.replace(/>\s+</g, '><'));
        const objB = parser.parse(expectedSvgContent.replace(/>\s+</g, '><'));
        console.error(`\n--- Generated SVG Object ---\n`, JSON.stringify(objA, null, 2));
        console.error(`\n--- Expected SVG Object ---\n`, JSON.stringify(objB, null, 2));
      }

      expect(structurallyEqualSvg(generatedSvg, expectedSvgContent)).toBe(true);
    });
  }
});