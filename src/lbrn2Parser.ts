import { XMLParser, XMLValidator } from "fast-xml-parser";
import type {
  LightBurnProjectFile,
  Lbrn2XForm,
  Lbrn2Vec2,
  PathPrimitiveIR,
  Lbrn2Path,
} from "./lbrn2Types";

const alwaysArrayPaths = [
  "LightBurnProject.Shape",
  "LightBurnProject.CutSetting",
  // For groups, Children can sometimes be a single Shape object not in an array if only one child.
  // This is handled by checking type inside parseShapeRecursive.
  // "LightBurnProject.Shape.Children.Shape" // if Children is an object with a Shape key
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
    if (alwaysArrayPaths.includes(jpath)) return true;
    // Handle cases like <Children><Shape>...</Shape><Shape>...</Shape></Children>
    if (jpath === "LightBurnProject.Shape.Children.Shape") return true;
    if (jpath === "LightBurnProject.Shape.BackupPath.Shape") return true; // Though BackupPath usually has one
    return false;
  },
  tagValueProcessor: (
    tagName: string,
    tagValue: unknown,
    jPath: string,
    hasAttributes: boolean,
    isLeafNode: boolean
  ): unknown => {
    if (
      jPath.endsWith(".XForm") || // Covers LightBurnProject.Shape.XForm and LightBurnProject.Shape.BackupPath.XForm etc.
      jPath.endsWith(".VertList") ||
      jPath.endsWith(".PrimList")
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
    // Do not throw, but log and return identity if critical, or handle upstream
    console.error(`Invalid XForm string, using identity: ${xformStr}`);
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }
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
  }
  return primitives;
}
function parseVertListString(vertListStr: string): Lbrn2Vec2[] {
  const vertices: Lbrn2Vec2[] = [];
  let i = 0;
  const len = vertListStr.length;
  while (i < len) {
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
      while (i < len) {
        const ch = vertListStr[i];
        if (ch !== undefined && /\s/.test(ch)) {
          i++;
        } else {
          break;
        }
      }
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
      while (i < len) {
        const ch = vertListStr[i];
        if (ch !== undefined && /\s/.test(ch)) {
          i++;
        } else {
          break;
        }
      }
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
      let cpStr = "";
      while (i < len && vertListStr[i] !== "V") {
        const ch = vertListStr[i];
        if (ch !== undefined) {
          cpStr += ch;
        }
        i++;
      }
      const controlPoints = parseControlPointData(cpStr.trim());
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      if (!isNaN(x) && !isNaN(y)) {
        vertices.push({ x, y, ...controlPoints });
      } else {
        console.warn(`Failed to parse vertex from X: "${xStr}", Y: "${yStr}" in VertList: "${vertListStr}"`);
      }
    } else {
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

  const vertexDataCache = new Map<
    string,
    { VertList: string; parsedVerts: Lbrn2Vec2[] }
  >();
  const primitiveDataCache = new Map<
    string,
    { PrimList: string; parsedPrimitives: PathPrimitiveIR[] }
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

      const parseShapeRecursive = (shape: any): any => {
        if (
          shape.Type === "Text" &&
          shape.HasBackupPath === 1 &&
          shape.BackupPath &&
          typeof shape.BackupPath === "object"
        ) {
            // BackupPath might be an object with a 'Shape' key if it's a single shape, or directly the shape.
            const backupShapeData = shape.BackupPath.Shape || shape.BackupPath;
            if (backupShapeData.Type === "Path") {
                const XFormVal = backupShapeData.XFormVal || backupShapeData.XForm; // XForm might be string or pre-parsed obj by this point
                shape = {
                    Type: "Path",
                    CutIndex: backupShapeData.CutIndex !== undefined ? backupShapeData.CutIndex : shape.CutIndex,
                    XFormVal: typeof XFormVal === 'string' ? XFormVal : undefined, // Store original string if available
                    XForm: typeof XFormVal === 'string' ? parseXFormString(XFormVal) : XFormVal, // Parse if string, else use as is
                    VertList: backupShapeData.VertList,
                    PrimList: backupShapeData.PrimList,
                    // Ensure VertID/PrimID from BackupPath are also carried if they exist
                    VertID: backupShapeData.VertID,
                    PrimID: backupShapeData.PrimID,
                };
            }
        }
        

        if (shape.Type === "Path") {
          const pathShape = shape as Lbrn2Path;
          if (pathShape.VertID !== undefined) pathShape.VertID = Number(pathShape.VertID);
          if (pathShape.PrimID !== undefined) pathShape.PrimID = Number(pathShape.PrimID);

          let resolvedVerts: Lbrn2Vec2[] = [];
          let resolvedVertListStr: string = "";
          let resolvedPrims: PathPrimitiveIR[] = [];
          let resolvedPrimListStr: string = "";

          if (pathShape.VertList && typeof pathShape.VertList === "string") {
            resolvedVertListStr = pathShape.VertList;
            resolvedVerts = parseVertListString(resolvedVertListStr);
            if (pathShape.VertID !== undefined) {
              vertexDataCache.set(String(pathShape.VertID), {
                VertList: resolvedVertListStr,
                parsedVerts: resolvedVerts,
              });
            }
          } else if (pathShape.VertID !== undefined) {
            const cachedVertData = vertexDataCache.get(String(pathShape.VertID));
            if (cachedVertData) {
              resolvedVertListStr = cachedVertData.VertList;
              resolvedVerts = cachedVertData.parsedVerts;
            } else {
              console.warn(`Vertex data for VertID=${pathShape.VertID} not found in cache. Path may be empty or invalid.`);
            }
          }

          if (pathShape.PrimList && typeof pathShape.PrimList === "string") {
            resolvedPrimListStr = pathShape.PrimList;
            if (resolvedPrimListStr === "LineClosed") {
              resolvedPrims = []; 
            } else {
              resolvedPrims = parsePrimListToIR(resolvedPrimListStr);
            }
            if (pathShape.PrimID !== undefined) {
              primitiveDataCache.set(String(pathShape.PrimID), {
                PrimList: resolvedPrimListStr,
                parsedPrimitives: resolvedPrims,
              });
            }
          } else if (pathShape.PrimID !== undefined) {
            const cachedPrimData = primitiveDataCache.get(String(pathShape.PrimID));
            if (cachedPrimData) {
              resolvedPrimListStr = cachedPrimData.PrimList;
              resolvedPrims = cachedPrimData.parsedPrimitives;
            } else {
              console.warn(`Primitive data for PrimID=${pathShape.PrimID} not found in cache. Path may be empty or invalid.`);
            }
          }
          
          pathShape.parsedVerts = resolvedVerts;
          pathShape.VertList = resolvedVertListStr; 
          pathShape.parsedPrimitives = resolvedPrims;
          pathShape.PrimList = resolvedPrimListStr;

          if (pathShape.parsedVerts.length === 0 && pathShape.PrimList !== "LineClosed") {
             // console.warn(`Path shape resulted in no vertices and is not LineClosed, might be skipped: ${JSON.stringify(pathShape)}`);
             // This path is likely invalid if it's not LineClosed and has no verts.
             // The filter(Boolean) later will remove it if it's nullified.
          }
        }

        if (shape.XFormVal && typeof shape.XFormVal === 'string') {
          shape.XForm = parseXFormString(shape.XFormVal);
        } else if (shape.XForm && typeof shape.XForm === 'string') {
           //This case can happen if XFormVal was missing but XForm (as string) was present, e.g. from BackupPath
          shape.XForm = parseXFormString(shape.XForm as unknown as string);
        }


        if (shape.Type === "Group" && shape.Children) {
          let childrenArr: any[] = [];
          if (Array.isArray(shape.Children)) {
            childrenArr = shape.Children;
          } else if (shape.Children.Shape !== undefined) { // Handles <Children><Shape>...</Shape></Children>
            childrenArr = Array.isArray(shape.Children.Shape) ? shape.Children.Shape : [shape.Children.Shape];
          } else if (typeof shape.Children === 'object' && shape.Children !== null) { // Handles single child not wrapped in Shape key
             childrenArr = [shape.Children];
          }
          shape.Children = childrenArr
            .map((child) => parseShapeRecursive(child))
            .filter(Boolean);
        }
        
        if (shape.Type === "Path" && (!shape.parsedVerts || shape.parsedVerts.length === 0)) {
           // A path without vertices is unrenderable.
           // Special case: LineClosed might imply a point if one vertex, M X,Y Z.
           // parsePathPrimitives handles LineClosed with 0 vertices by returning "".
           // So, if parsedVerts is empty, it's generally not drawable.
           console.warn(`Path shape has no vertices after resolution, skipping: ${JSON.stringify(shape)}`);
           return null;
        }

        if (shape.Type !== "Text" && !shape.XForm) {
          if (shape.Type !== "Group" || (shape.Type === "Group" && (!shape.Children || shape.Children.length === 0))) {
            console.warn(
              `Shape type ${
                shape.Type
              } is missing XForm and is not a non-empty Group, skipping: ${JSON.stringify(
                shape
              )}`
            );
            return null;
          }
        }
        return shape;
      };

      parsed.LightBurnProject.Shape = parsed.LightBurnProject.Shape.map(
        (s) => parseShapeRecursive(s)
      ).filter(Boolean);
    } else {
      parsed.LightBurnProject.Shape = [];
    }
  } else {
    throw new Error("Root <LightBurnProject> element not found.");
  }

  return parsed;
}
