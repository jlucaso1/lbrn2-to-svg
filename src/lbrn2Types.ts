export interface Lbrn2Vec2 {
  x: number;
  y: number;
}

export interface Lbrn2XForm {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface Lbrn2CutSetting {
  index: number;
  name: string;
  // Add other relevant properties if needed for styling, e.g. color
  // For now, we mostly care about the index to link shapes.
}

export interface Lbrn2ShapeBase {
  Type: string;
  CutIndex: number;
  XFormVal: string; // Raw XForm string "a b c d e f"
  XForm?: Lbrn2XForm; // Parsed XForm
}

export interface Lbrn2Rect extends Lbrn2ShapeBase {
  Type: "Rect";
  W: number;
  H: number;
  Cr: number; // Corner radius
}

export interface Lbrn2Ellipse extends Lbrn2ShapeBase {
  Type: "Ellipse";
  Rx: number;
  Ry: number;
}

export interface Lbrn2Path extends Lbrn2ShapeBase {
  Type: "Path";
  VertList: string; // Raw VertList string
  PrimList: string; // Raw PrimList string
  parsedVerts?: Lbrn2Vec2[];
  // Further parsed PrimList structure could be added
}

export type Lbrn2Shape = Lbrn2Rect | Lbrn2Ellipse | Lbrn2Path;

export interface LightBurnProjectFile {
  LightBurnProject: {
    AppVersion: string;
    FormatVersion: string;
    CutSetting?: Lbrn2CutSetting[] | Lbrn2CutSetting; // Can be single or array
    Shape?: Lbrn2Shape[] | Lbrn2Shape; // Can be single or array
    // Other top-level elements like Thumbnail, Notes, etc.
  };
}