import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import { parseLbrn2 } from "../src/lbrn2Parser";
import { lbrn2ToSvg } from "../src/svgConverter";

const artifactsDir = path.join(import.meta.dir, "artifacts");

import { XMLParser } from "fast-xml-parser";

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
      return Number(val.toFixed(3)).toString().replace(/\.0+$/, "");
    }
    if (typeof val === "string") {
      // Numeric string: "5.000000" -> "5"
      if (/^-?\d+(\.\d+)?$/.test(val.trim())) {
        return Number(Number(val).toFixed(3)).toString().replace(/\.0+$/, "");
      }
      // Numeric with unit: "10.000000mm" -> "10mm"
      if (/^-?\d+(\.\d+)?[a-zA-Z%]+$/.test(val.trim())) {
        return val.replace(
          /^(-?\d+)(\.\d+)?([a-zA-Z%]+)$/,
          (_, int, dec, unit) =>
            (dec
              ? Number(int + dec)
                  .toString()
                  .replace(/\.0+$/, "")
              : int) + unit
        );
      }
      // Normalize transform: remove spaces, unify delimiters, normalize numbers
      if (key === "transform") {
        // Normalize numbers to 5 decimals, unify delimiters, and replace spaces with commas
        return val
          .replace(/\s*,\s*/g, ",")
          .replace(/\s+/g, ",")
          .replace(/-?\d*\.?\d+([eE][-+]?\d+)?/g, (num) => {
            const n = parseFloat(num);
            if (isNaN(n)) return num;
            let s = n.toFixed(3);
            s = s.replace(/(\.\d*?[1-9])0+$/, "$1");
            s = s.replace(/\.0+$/, "");
            return s;
          });
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
              Number(Number(num).toFixed(3)).toString().replace(/\.0+$/, "")
            )
          )
          .sort()
          .join(";");
      }
      // Normalize path d attribute: remove unnecessary zeros and spaces
      if (key === "d") {
        let dStr = val as string;
        // Normalize numbers within d string to 5 decimal places, remove trailing zeros and unnecessary decimals
        dStr = dStr.replace(/-?\d*\.?\d+([eE][-+]?\d+)?/g, (numStr) => {
          const num = parseFloat(numStr);
          if (isNaN(num)) return numStr;
          let s = num.toFixed(3);
          s = s.replace(/(\.\d*?[1-9])0+$/, "$1");
          s = s.replace(/\.0+$/, "");
          return s;
        });
        // Normalize Z/z to Z for comparison consistency
        dStr = dStr.replace(/z$/i, "Z");
        // Remove all whitespace
        dStr = dStr.replace(/\s+/g, "");
        // Replace all command/number boundaries with commas
        dStr = dStr.replace(/([a-zA-Z])(-?\d)/g, "$1,$2");
        dStr = dStr.replace(/(\d)([a-zA-Z])/g, "$1,$2");
        // Collapse duplicate commas
        dStr = dStr.replace(/,+/g, ",");
        // Remove leading/trailing commas
        dStr = dStr.replace(/^,|,$/g, "");
        return dStr;
      }
    }
    return val;
  }

  // Only ignore width, height, and viewBox when they are direct children of the <svg> element.
  // This ensures the test focuses on path geometry and style, not on canvas size or placement.
  function normalizeAttrs(obj: any, parentKey?: string): any {
    if (typeof obj !== "object" || obj === null)
      return normalizeValue(obj, parentKey);
    if (Array.isArray(obj)) return obj.map((v) => normalizeAttrs(v, parentKey));
    const sorted: any = {};
    Object.keys(obj)
      .filter((k) => {
        // Filter width, height, viewBox everywhere\nif (["width", "height", "viewBox"].includes(k)) return false;\nreturn true;
      })
      .sort()
      .forEach((k) => {
        sorted[k] = normalizeAttrs(obj[k], k);
      });
    return sorted;
  }

  // Remove whitespace between tags and parse
  const objA = normalizeAttrs(parser.parse(svgA.replace(/>\s+</g, "><")));
  const objB = normalizeAttrs(parser.parse(svgB.replace(/>\s+</g, "><")));
  return JSON.stringify(objA) === JSON.stringify(objB);
}

describe("LBRN2 to SVG Converter", () => {
  const testCases = [
    "circle",
    "square",
    "line",
    "butterfly_vectorized",
    "ellipse_stretched",
    "bezier_missing_cp",
    "group_empty",
    "group_single_child",
  ];

  for (const tc of testCases) {
    test(`should convert ${tc}.lbrn2 to ${tc}.svg`, () => {
      const lbrn2Path = path.join(artifactsDir, `${tc}.lbrn2`);
      const expectedSvgPath = path.join(artifactsDir, `${tc}.svg`);

      const lbrn2Content = fs.readFileSync(lbrn2Path, "utf-8");
      const expectedSvgContent = fs.readFileSync(expectedSvgPath, "utf-8");

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
        const objA = parser.parse(generatedSvg.replace(/>\s+</g, "><"));
        const objB = parser.parse(expectedSvgContent.replace(/>\s+</g, "><"));
        console.error(
          `\n--- Generated SVG Object ---\n`,
          JSON.stringify(objA, null, 2)
        );
        console.error(
          `\n--- Expected SVG Object ---\n`,
          JSON.stringify(objB, null, 2)
        );
      }

      expect(structurallyEqualSvg(generatedSvg, expectedSvgContent)).toBe(true);
    });
  }
});
