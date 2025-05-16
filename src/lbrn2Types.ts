export interface Lbrn2Vec2 {
  x: number;
  y: number;
  c0x?: number; // Control point 0 x (for curve leaving this vertex)
  c0y?: number; // Control point 0 y
  c1x?: number; // Control point 1 x (for curve arriving at this vertex)
  c1y?: number; // Control point 1 y
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
  color?: string; // Optional color property for styling
  strokeWidth?: string; // Optional stroke width for styling
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

export interface Lbrn2Group extends Lbrn2ShapeBase {
  Type: "Group";
  Children: Lbrn2Shape[];
}

export type Lbrn2Shape = Lbrn2Rect | Lbrn2Ellipse | Lbrn2Path | Lbrn2Group;

export interface LightBurnProjectFile {
  LightBurnProject: {
    AppVersion: string;
    FormatVersion: string;
    CutSetting?: Lbrn2CutSetting[] | Lbrn2CutSetting; // Can be single or array
    Shape?: Lbrn2Shape[] | Lbrn2Shape; // Can be single or array
    // Other top-level elements like Thumbnail, Notes, etc.
  };
}
