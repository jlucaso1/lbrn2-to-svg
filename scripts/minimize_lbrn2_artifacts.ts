import fs from "fs";
import path from "path";
import {
  XMLParser,
  XMLBuilder,
  type X2jOptions,
  type XmlBuilderOptions,
} from "fast-xml-parser";

const artifactsDir = path.join(import.meta.dir, "../tests/artifacts");

const elementsToRemoveFromRoot: string[] = [
  "Thumbnail",
  "VariableText",
  "UIPrefs",
  "Notes",
  "CutSetting_Img",
];

const attributesToRemoveFromLightBurnProject: string[] = [
  "DeviceName",
  "MaterialHeight",
  "MirrorX",
  "MirrorY",
];

// These are child elements within CutSetting that will be removed.
// Their tags become keys in the parsed CutSetting object.
const childElementsToRemoveFromCutSetting: string[] = [
  "minPower",
  "maxPower",
  "minPower2",
  "maxPower2",
  "speed",
  "PPI",
  "JumpSpeed",
  "wobbleStep",
  "wobbleSize",
  "wobbleEnable",
  "numPasses",
  "perfLen",
  "perfSkip",
  "dotTime",
  "bidir",
  "crossHatch",
  "overscan",
  "interval",
  "angle",
  "priority",
  "tabCount",
  "tabCountMax",
  "Gamma",
  "Contrast",
  "Brightness",
  "EnhanceAmount",
  "EnhanceRadius",
  "EnhanceDenoise",
  "File",
  "SourceHash",
  "EnhanceRadius",
  "EnhanceRadius",
];

const attributesToRemoveFromShape: string[] = ["VertID"];

const parserOptions: X2jOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: true, // Process tag values
  parseAttributeValue: false, // Process attribute values
  // Ensure elements that can be single or multiple are always arrays
  isArray: (
    name: string,
    jpath: string,
    isLeafNode: boolean,
    isAttribute: boolean
  ): boolean => {
    return [
      "LightBurnProject.CutSetting",
      "LightBurnProject.Shape",
      "LightBurnProject.Shape.Children.Shape", // For nested shapes in groups
    ].includes(jpath);
  },
  preserveOrder: false, // Simplifies object manipulation
  processEntities: true,
  trimValues: true,
};

const builderOptions: XmlBuilderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  suppressEmptyNode: true, // e.g. <Children/> if it becomes empty after processing
  commentPropName: false,
  processEntities: true,
  preserveOrder: false,
  format: true,
};

function processShapesRecursive(shapes: any | any[]): void {
  if (!shapes) return;
  const shapesArray = Array.isArray(shapes) ? shapes : [shapes];

  for (const shape of shapesArray) {
    if (typeof shape !== "object" || shape === null) continue;

    // Remove specified attributes from the shape itself
    for (const attrName of attributesToRemoveFromShape) {
      if (shape[attrName] !== undefined) {
        delete shape[attrName];
        // console.log(`  - Removed attribute ${attrName} from Shape ${shape.Type || ''}`);
      }
    }

    // If it's a Group, recurse for its children
    if (shape.Type === "Group" && shape.Children && shape.Children.Shape) {
      processShapesRecursive(shape.Children.Shape);
    }
  }
}

async function processLbrn2File(filePath: string): Promise<void> {
  console.log(`Processing ${path.basename(filePath)}...`);
  try {
    const xmlData = fs.readFileSync(filePath, "utf8");
    const parser = new XMLParser(parserOptions);
    let parsedObj = parser.parse(xmlData);

    if (!parsedObj.LightBurnProject) {
      console.warn(
        `  No LightBurnProject root found in ${filePath}. Skipping.`
      );
      return;
    }

    const project = parsedObj.LightBurnProject;

    // 1. Remove top-level unwanted elements
    for (const elementName of elementsToRemoveFromRoot) {
      if (project[elementName] !== undefined) {
        delete project[elementName];
        // console.log(`  - Removed element ${elementName}`);
      }
    }

    // 2. Remove attributes from LightBurnProject
    for (const attrName of attributesToRemoveFromLightBurnProject) {
      if (project[attrName] !== undefined) {
        delete project[attrName];
        // console.log(`  - Removed attribute ${attrName} from LightBurnProject`);
      }
    }

    // 3. Process CutSetting array
    if (project.CutSetting && Array.isArray(project.CutSetting)) {
      for (const setting of project.CutSetting) {
        if (typeof setting !== "object" || setting === null) continue;
        for (const childElementName of childElementsToRemoveFromCutSetting) {
          if (setting[childElementName] !== undefined) {
            delete setting[childElementName];
            // console.log(`  - Removed child element ${childElementName} from a CutSetting`);
          }
        }
      }
    }

    // 4. Process Shape array (and their children recursively)
    if (project.Shape) {
      processShapesRecursive(project.Shape);
    }

    const builder = new XMLBuilder(builderOptions);
    const outputXml = builder.build(parsedObj);

    // The builder should include the XML declaration, but let's ensure.
    const finalOutput = outputXml.startsWith("<?xml")
      ? outputXml
      : `<?xml version="1.0" encoding="UTF-8"?>\n${outputXml}`;

    fs.writeFileSync(filePath, finalOutput, "utf8");
    console.log(`  Successfully minimized ${path.basename(filePath)}.`);
  } catch (error) {
    console.error(`  Error processing ${filePath}:`, error);
  }
}

async function main() {
  console.log("Starting LBRN2 artifact minimization...");
  if (!fs.existsSync(artifactsDir)) {
    console.error(`Artifacts directory not found: ${artifactsDir}`);
    return;
  }

  const files = fs.readdirSync(artifactsDir);
  for (const file of files) {
    if (file.endsWith(".lbrn2")) {
      await processLbrn2File(path.join(artifactsDir, file));
    }
  }
  console.log("Minimization complete.");
}

main().catch(console.error);
