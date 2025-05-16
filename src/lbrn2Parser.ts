import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { LightBurnProjectFile, Lbrn2XForm, Lbrn2Vec2 } from "./lbrn2Types";

const alwaysArrayPaths = [
  "LightBurnProject.Shape",
  "LightBurnProject.CutSetting",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: true,
  parseAttributeValue: true,
  isArray: (
    name: string,
    jpath: string,
    isLeafNode: boolean,
    isAttribute: boolean
  ): boolean => {
    return alwaysArrayPaths.includes(jpath);
  },
  tagValueProcessor: (
    tagName: string,
    tagValue: unknown,
    jPath: string,
    hasAttributes: boolean,
    isLeafNode: boolean
  ): unknown => {
    if (
      jPath === "LightBurnProject.Shape.XForm" ||
      jPath === "LightBurnProject.Shape.VertList" ||
      jPath === "LightBurnProject.Shape.PrimList"
    ) {
      return String(tagValue);
    }
    return tagValue;
  },
});

function parseXFormString(xformStr: string): Lbrn2XForm {
  const parts = xformStr.split(/\s+/).map((v) => Number(v));
  if (
    parts.length !== 6 ||
    parts.some((n) => typeof n !== "number" || isNaN(n))
  ) {
    throw new Error(`Invalid XForm string: ${xformStr}`);
  }
  // Type assertion is safe due to above check
  return {
    a: parts[0]!,
    b: parts[1]!,
    c: parts[2]!,
    d: parts[3]!,
    e: parts[4]!,
    f: parts[5]!,
  };
}

function parseControlPointData(
  cpString: string | undefined
): Partial<Pick<Lbrn2Vec2, "c0x" | "c0y" | "c1x" | "c1y">> {
  const data: Partial<Pick<Lbrn2Vec2, "c0x" | "c0y" | "c1x" | "c1y">> = {};
  if (!cpString || !cpString.startsWith("c")) {
    return data;
  }
  // Explicit parser: scan for c0x/c0y/c1x/c1y followed by a number
  let i = 0;
  while (i < cpString.length) {
    if (
      cpString.startsWith("c0x", i) ||
      cpString.startsWith("c0y", i) ||
      cpString.startsWith("c1x", i) ||
      cpString.startsWith("c1y", i)
    ) {
      const key = cpString.slice(i, i + 3) as "c0x" | "c0y" | "c1x" | "c1y";
      i += 3;
      // Parse number (may include sign, decimal, exponent)
      let numStr = "";
      while (i < cpString.length) {
        const ch = cpString[i];
        if (ch !== undefined) {
          if (
            ch === "-" ||
            ch === "+" ||
            (ch >= "0" && ch <= "9") ||
            ch === "." ||
            ch === "e" ||
            ch === "E"
          ) {
            numStr += ch;
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      const value = parseFloat(numStr);
      if (!isNaN(value)) {
        data[key] = value;
      }
    } else {
      i++;
    }
  }
  return data;
}

// Parse PrimList string into IR array of primitives
import type { PathPrimitiveIR } from "./lbrn2Types";
function parsePrimListToIR(primListStr: string): PathPrimitiveIR[] {
  const primitives: PathPrimitiveIR[] = [];
  let i = 0;
  const len = primListStr.length;

  function parseNextInt(): number | null {
    while (i < len && /\s/.test(primListStr[i] ?? "")) i++;
    let numStr = "";
    while (i < len && /[0-9]/.test(primListStr[i] ?? "")) {
      numStr += primListStr[i];
      i++;
    }
    return numStr.length > 0 ? Number(numStr) : null;
  }

  while (i < len) {
    while (i < len && /\s/.test(primListStr[i] ?? "")) i++;
    if (i >= len) break;
    const type = primListStr[i];
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
    if (
      type === "L" &&
      args.length === 2 &&
      args[0] !== undefined &&
      args[1] !== undefined
    ) {
      primitives.push({
        type: "Line",
        startIdx: args[0] as number,
        endIdx: args[1] as number,
      });
    } else if (
      type === "B" &&
      args.length === 2 &&
      args[0] !== undefined &&
      args[1] !== undefined
    ) {
      primitives.push({
        type: "Bezier",
        startIdx: args[0] as number,
        endIdx: args[1] as number,
      });
    }
    // Extend for Q, C, etc. as needed
  }
  return primitives;
}
function parseVertListString(vertListStr: string): Lbrn2Vec2[] {
  const vertices: Lbrn2Vec2[] = [];
  let i = 0;
  const len = vertListStr.length;
  while (i < len) {
    // Skip whitespace
    while (i < len) {
      const ch = vertListStr[i];
      if (ch !== undefined && /\s/.test(ch)) {
        i++;
      } else {
        break;
      }
    }
    if (i < len && vertListStr[i] === "V") {
      i++;
      // Skip whitespace
      while (i < len) {
        const ch = vertListStr[i];
        if (ch !== undefined && /\s/.test(ch)) {
          i++;
        } else {
          break;
        }
      }
      // Parse x
      let xStr = "";
      while (i < len) {
        const ch = vertListStr[i];
        if (ch !== undefined) {
          if (
            ch === "-" ||
            ch === "+" ||
            (ch >= "0" && ch <= "9") ||
            ch === "." ||
            ch === "e" ||
            ch === "E"
          ) {
            xStr += ch;
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      // Skip whitespace
      while (i < len) {
        const ch = vertListStr[i];
        if (ch !== undefined && /\s/.test(ch)) {
          i++;
        } else {
          break;
        }
      }
      // Parse y
      let yStr = "";
      while (i < len) {
        const ch = vertListStr[i];
        if (ch !== undefined) {
          if (
            ch === "-" ||
            ch === "+" ||
            (ch >= "0" && ch <= "9") ||
            ch === "." ||
            ch === "e" ||
            ch === "E"
          ) {
            yStr += ch;
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      // Parse control point string (until next 'V' or end)
      let cpStr = "";
      while (i < len && vertListStr[i] !== "V") {
        const ch = vertListStr[i];
        if (ch !== undefined) {
          cpStr += ch;
        }
        i++;
      }
      const controlPoints = parseControlPointData(cpStr.trim());
      vertices.push({
        x: parseFloat(xStr),
        y: parseFloat(yStr),
        ...controlPoints,
      });
    } else {
      // Skip unknown/invalid chars
      i++;
    }
  }
  return vertices;
}

export function parseLbrn2(xmlString: string): LightBurnProjectFile {
  if (XMLValidator.validate(xmlString) !== true) {
    throw new Error("Invalid XML structure for LBRN2 file.");
  }
  const parsed = parser.parse(xmlString) as LightBurnProjectFile;

  // Cache for path definitions (VertList, PrimList, and their parsed counterparts)
  const pathDefinitionCache = new Map<
    string,
    {
      VertList: string;
      PrimList: string;
      parsedVerts?: Lbrn2Vec2[];
      parsedPrimitives?: PathPrimitiveIR[];
    }
  >();

  if (parsed.LightBurnProject) {
    if (parsed.LightBurnProject.CutSetting) {
      if (!Array.isArray(parsed.LightBurnProject.CutSetting)) {
        parsed.LightBurnProject.CutSetting = [
          parsed.LightBurnProject.CutSetting,
        ];
      }
      parsed.LightBurnProject.CutSetting.forEach((cs) => {
        if (!cs) return;
        // Flatten all properties with a single 'Value' key
        for (const key in cs) {
          if (Object.prototype.hasOwnProperty.call(cs, key)) {
            const val = (cs as any)[key];
            if (
              val &&
              typeof val === "object" &&
              Object.prototype.hasOwnProperty.call(val, "Value")
            ) {
              if (Object.keys(val).length === 1) {
                (cs as any)[key] = val.Value;
              }
            }
          }
        }
      });
    } else {
      parsed.LightBurnProject.CutSetting = [];
    }

    if (parsed.LightBurnProject.Shape) {
      if (!Array.isArray(parsed.LightBurnProject.Shape)) {
        parsed.LightBurnProject.Shape = [parsed.LightBurnProject.Shape];
      }

      // Define parseShapeRecursive to accept the cache
      const parseShapeRecursive = (
        shape: any,
        cache: typeof pathDefinitionCache
      ): any => {
        // Handle Text with BackupPath: substitute Text shape with Path from BackupPath
        if (
          shape.Type === "Text" &&
          shape.HasBackupPath === 1 &&
          shape.BackupPath &&
          typeof shape.BackupPath === "object" &&
          shape.BackupPath.Type === "Path" &&
          typeof shape.BackupPath.XForm === "string" &&
          typeof shape.BackupPath.VertList === "string" &&
          typeof shape.BackupPath.PrimList === "string"
        ) {
          // Create a new Path shape from BackupPath data
          const backupData = shape.BackupPath;
          shape = {
            Type: "Path",
            CutIndex:
              backupData.CutIndex !== undefined
                ? backupData.CutIndex
                : shape.CutIndex,
            XFormVal: backupData.XForm,
            XForm: parseXFormString(backupData.XForm),
            VertList: backupData.VertList,
            PrimList: backupData.PrimList,
          };
        }

        // Handle Path definition and reuse
        if (shape.Type === "Path") {
          // VertID and PrimID should be parsed as numbers by fast-xml-parser due to parseAttributeValue: true
          // If they are strings, ensure conversion:
          if (shape.VertID !== undefined && typeof shape.VertID === "string") {
            shape.VertID = parseInt(String(shape.VertID), 10);
          }
          if (shape.PrimID !== undefined && typeof shape.PrimID === "string") {
            shape.PrimID = parseInt(String(shape.PrimID), 10);
          }

          const cacheKey =
            shape.VertID !== undefined && shape.PrimID !== undefined
              ? `${shape.VertID}_${shape.PrimID}`
              : null;

          if (
            shape.VertList &&
            typeof shape.VertList === "string" &&
            shape.PrimList &&
            typeof shape.PrimList === "string"
          ) {
            // This shape defines the path geometry
            shape.parsedVerts = parseVertListString(shape.VertList);
            shape.parsedPrimitives = parsePrimListToIR(shape.PrimList);

            if (cacheKey) {
              cache.set(cacheKey, {
                VertList: shape.VertList,
                PrimList: shape.PrimList,
                parsedVerts: shape.parsedVerts,
                parsedPrimitives: shape.parsedPrimitives,
              });
            }
          } else if (cacheKey) {
            // This shape reuses a definition
            const cachedDef = cache.get(cacheKey);
            if (cachedDef) {
              shape.VertList = cachedDef.VertList;
              shape.PrimList = cachedDef.PrimList;
              shape.parsedVerts = cachedDef.parsedVerts;
              shape.parsedPrimitives = cachedDef.parsedPrimitives;
            } else {
              console.warn(
                `Path definition for VertID=${shape.VertID}, PrimID=${
                  shape.PrimID
                } not found in cache. Shape will be empty or invalid: ${JSON.stringify(
                  shape
                )}`
              );
              shape.parsedVerts = [];
              shape.parsedPrimitives = [];
            }
          } else {
            // Path shape without VertList/PrimList AND without a valid cacheKey for reuse.
            if (!shape.VertList && !shape.PrimList) {
              console.warn(
                `Path shape is missing VertList/PrimList and VertID/PrimID for reuse. Treating as empty: ${JSON.stringify(
                  shape
                )}`
              );
              shape.parsedVerts = [];
              shape.parsedPrimitives = [];
            }
          }
        }

        // Parse XForm for current shape (after potential geometry population from cache/BackupPath)
        if (shape.XFormVal) {
          shape.XForm = parseXFormString(shape.XFormVal);
        } else if (shape.XForm && typeof shape.XForm === "string") {
          shape.XForm = parseXFormString(shape.XForm as unknown as string);
        }

        if (shape.Type === "Group" && shape.Children) {
          // Children can be a single shape, array, or { Shape: ... }
          let childrenArr: any[] = [];
          if (Array.isArray(shape.Children)) {
            childrenArr = shape.Children;
          } else if (shape.Children.Shape !== undefined) {
            if (Array.isArray(shape.Children.Shape)) {
              childrenArr = shape.Children.Shape;
            } else {
              childrenArr = [shape.Children.Shape];
            }
          } else if (shape.Children) {
            childrenArr = [shape.Children];
          }
          shape.Children = childrenArr
            .map((child) => parseShapeRecursive(child, cache))
            .filter(Boolean); // Pass cache
        }

        // Ensure all non-Text shapes that are not Groups being emptied have a parsed XForm
        // or are otherwise valid.
        if (shape.Type !== "Text" && !shape.XForm) {
          // A Group might legitimately not have an XForm if it's an identity transform at the root,
          // but its children will. For other shapes, XForm is essential.
          // If a Path lost its geometry and has no XForm, it's definitely skippable.
          if (
            shape.Type === "Path" &&
            (!shape.parsedVerts || shape.parsedVerts.length === 0)
          ) {
            return null; // Skip paths that ended up with no geometry
          }
          if (shape.Type !== "Group") {
            // Groups might be containers
            console.warn(
              `Shape type ${
                shape.Type
              } is missing XForm, may not render correctly or be skipped: ${JSON.stringify(
                shape
              )}`
            );
            // Returning null for non-Group, non-Text shapes without XForm:
            return null;
          }
        }

        return shape;
      };

      parsed.LightBurnProject.Shape = parsed.LightBurnProject.Shape.map(
        (shape) => parseShapeRecursive(shape, pathDefinitionCache)
      ).filter(Boolean); // Remove null shapes
    } else {
      parsed.LightBurnProject.Shape = [];
    }
  } else {
    throw new Error("Root <LightBurnProject> element not found.");
  }

  return parsed;
}
