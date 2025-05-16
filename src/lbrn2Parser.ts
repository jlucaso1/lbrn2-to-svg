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

function parseVertListString(vertListStr: string): Lbrn2Vec2[] {
  const vertices: Lbrn2Vec2[] = [];
  const regex = /V\s*([-\d.]+)\s*([-\d.]+)(?:c[^\sV]*)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(vertListStr)) !== null) {
    const xStr = match[1];
    const yStr = match[2];
    if (typeof xStr === "string" && typeof yStr === "string") {
      vertices.push({ x: parseFloat(xStr), y: parseFloat(yStr) });
    }
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
            if (cs && (cs as any).index && typeof (cs as any).index.Value === 'number') {
                cs.index = (cs as any).index.Value;
            } else if (cs && typeof cs.index === 'number') {
            } else {
            }
        });
    } else {
        parsed.LightBurnProject.CutSetting = [];
    }

    if (parsed.LightBurnProject.Shape) {
      if (!Array.isArray(parsed.LightBurnProject.Shape)) {
        parsed.LightBurnProject.Shape = [parsed.LightBurnProject.Shape];
      }
      parsed.LightBurnProject.Shape.forEach(shape => {
        if (shape.XFormVal) {
          shape.XForm = parseXFormString(shape.XFormVal);
        } else if (shape.XForm && typeof shape.XForm === 'string') {
           shape.XForm = parseXFormString(shape.XForm as unknown as string);
        }

        if (shape.Type === "Path") {
          if (shape.VertList && typeof shape.VertList === 'string') {
            shape.parsedVerts = parseVertListString(shape.VertList);
          }
        }
      });
    } else {
      parsed.LightBurnProject.Shape = [];
    }
  } else {
    throw new Error("Root <LightBurnProject> element not found.");
  }

  return parsed;
}