import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { LightBurnProjectFile, Lbrn2Shape, Lbrn2XForm, Lbrn2Vec2, Lbrn2CutSetting } from './lbrn2Types';

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
  }
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
    a: parts[0] as number,
    b: parts[1] as number,
    c: parts[2] as number,
    d: parts[3] as number,
    e: parts[4] as number,
    f: parts[5] as number,
  };
}

function parseControlPointData(cpString: string | undefined): Partial<Pick<Lbrn2Vec2, 'c0x' | 'c0y' | 'c1x' | 'c1y'>> {
  const data: Partial<Pick<Lbrn2Vec2, 'c0x' | 'c0y' | 'c1x' | 'c1y'>> = {};
  if (!cpString || !cpString.startsWith('c')) {
    return data;
  }
  // Regex to find c0x, c0y, c1x, c1y and their values
  // Example: c0x12.3c0y45.6 (key "c0x", value "12.3"; key "c0y", value "45.6")
  const cpRegex = /(c0x|c0y|c1x|c1y)([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;
  let matchCp: RegExpExecArray | null;
  while ((matchCp = cpRegex.exec(cpString)) !== null) {
    const key = matchCp[1] as 'c0x' | 'c0y' | 'c1x' | 'c1y';
    const value = parseFloat(matchCp[2] ?? "");
    if (!isNaN(value)) {
      data[key] = value;
    }
  }
  return data;
}

function parseVertListString(vertListStr: string): Lbrn2Vec2[] {
  const vertices: Lbrn2Vec2[] = [];
  // Regex to capture V x y and the following c... string until the next V or end of string
  const regex = /V\s*([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s*([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)([^\sV]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(vertListStr)) !== null) {
    const xStr = match[1];
    const yStr = match[2];
    const cpStr = match[3]; // This will be like "c0x..." or "c..." or empty
    const controlPoints = parseControlPointData(cpStr);
    vertices.push({ x: parseFloat(xStr ?? ""), y: parseFloat(yStr ?? ""), ...controlPoints });
  }
  return vertices;
}

export function parseLbrn2(xmlString: string): LightBurnProjectFile {
  if (XMLValidator.validate(xmlString) !== true) {
    throw new Error("Invalid XML structure for LBRN2 file.");
  }
  const parsed = parser.parse(xmlString) as LightBurnProjectFile;

  if (parsed.LightBurnProject) {
    if (parsed.LightBurnProject.CutSetting) {
        if (!Array.isArray(parsed.LightBurnProject.CutSetting)) {
            parsed.LightBurnProject.CutSetting = [parsed.LightBurnProject.CutSetting];
        }
        parsed.LightBurnProject.CutSetting.forEach(cs => {
            if (!cs) return;
            // Flatten all properties with a single 'Value' key
            for (const key in cs) {
                if (Object.prototype.hasOwnProperty.call(cs, key)) {
                    const val = (cs as any)[key];
                    if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, 'Value')) {
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
      function parseShapeRecursive(shape: any): any {
        if (shape.XFormVal) {
          shape.XForm = parseXFormString(shape.XFormVal);
        } else if (shape.XForm && typeof shape.XForm === 'string') {
          shape.XForm = parseXFormString(shape.XForm as unknown as string);
        }

        if (shape.Type === "Path") {
          if (shape.VertList && typeof shape.VertList === 'string') {
            shape.parsedVerts = parseVertListString(shape.VertList);
          }
        } else if (shape.Type === "Group" && shape.Children) {
          // Children can be a single shape or array
          let childrenArr = shape.Children.Shape;
          if (!Array.isArray(childrenArr)) {
            childrenArr = [childrenArr];
          }
          shape.Children = childrenArr.map(parseShapeRecursive);
        }
        return shape;
      }

      parsed.LightBurnProject.Shape = parsed.LightBurnProject.Shape.map(parseShapeRecursive);
    } else {
      parsed.LightBurnProject.Shape = [];
    }
  } else {
    throw new Error("Root <LightBurnProject> element not found.");
  }

  return parsed;
}