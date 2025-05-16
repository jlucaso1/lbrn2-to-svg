Detailed Specification of LBRN2 and Comparison with SVG
Introduction

This document provides a detailed specification of the LBRN2 file format used by LightBurn software and compares it with the SVG (Scalable Vector Graphics) format. The goal is to support the implementation of a parser in a Node.js/TypeScript application. This specification is based on analysis of sample LBRN2 files and community insights.

LBRN2 Specification Overview

Purpose: LBRN2 is the default project file format for LightBurn, a software for designing and controlling laser cutters and engravers. It stores comprehensive project data, including design elements and laser-specific settings.
File Extension: .lbrn2 (replacing the legacy .lbrn format).
Format: XML-based, structured as a hierarchical document with tags and attributes.
Key Features:
Stores vector graphics (shapes like rectangles, ellipses, paths), text, and raster images.
Includes laser settings (e.g., power, speed, number of passes) through `<CutSetting>` elements.
Shapes are associated with `<CutSetting>` elements via a `CutIndex` attribute.
Contains machine configurations and UI preferences.

Comparison with .lbrn:
.lbrn2 is generally more compact. Shape transformations, for example, are often handled by a nested `<XForm>` element containing a transformation matrix, rather than multiple individual attributes for position, rotation, and scale.

File Structure

The LBRN2 format is XML-based. Based on analysis of provided artifact files (`circle.lbrn2`, `line.lbrn2`, `square.lbrn2`):

Root Element: `<LightBurnProject>`
Attributes: `AppVersion`, `DeviceName`, `FormatVersion`, `MaterialHeight`, `MirrorX`, `MirrorY`.
Encapsulates all project data.

Key Child Elements of `<LightBurnProject>`:

*   `<Thumbnail>`: (Typically Base64 encoded image, can be ignored for geometric conversion)
*   `<VariableText>`: (Settings for variable text features, can be ignored for basic geometry)
*   `<UIPrefs>`: (User interface preferences, can be ignored for geometry)
*   `<CutSetting type="Cut">`: Defines a set of laser parameters (a "cut layer").
    *   Attributes: `type`
    *   Child Elements: `<index>` (0-based identifier for the setting), `<name>`, `<minPower>`, `<maxPower>`, `<speed>`, etc. Shapes refer to these settings using their `CutIndex` attribute.
*   `<Shape>`: Defines a geometric object.
    *   Attributes: `Type` (e.g., "Rect", "Ellipse", "Path"), `CutIndex` (links to a `<CutSetting>`).
    *   Child Element: `<XForm>`: Contains a 6-value string representing an affine transformation matrix (`a b c d e f`). This matrix defines the shape's position, scale, and skew in the project.
    *   Shape-specific attributes and child elements:
        *   For `Type="Rect"`:
            *   Attributes: `W` (width), `H` (height), `Cr` (corner radius).
            *   The rectangle is typically defined with its center at the local origin (0,0) before the `<XForm>` is applied.
        *   For `Type="Ellipse"`:
            *   Attributes: `Rx` (radius in X), `Ry` (radius in Y).
            *   The ellipse is typically defined centered at the local origin (0,0) before `<XForm>` is applied.
        *   For `Type="Path"`:
            *   Child Element `<VertList>`: Contains vertex data. Each vertex entry starts with `V<x> <y>`.
                *   The characters immediately following `V<x> <y>` (until the next `V` or the end of the `VertList` string) constitute the control point data string for that vertex.
                *   This control point data string is a concatenation of keys like `c0x`, `c0y`, `c1x`, `c1y`, each immediately followed by its numeric value. For example, `c0x12.5c0y-4.5` means control point 0 has x=12.5 and y=-4.5.
                *   Not all four control point components (`c0x`, `c0y`, `c1x`, `c1y`) need to be present for a given vertex.
                *   Example: `V49 48c0x1.5c1x49.5c1y47.5V62 63c0x62.2c0y63.3`
                    *   The first vertex is at (49, 48) with `c0x=1.5`, `c1x=49.5`, `c1y=47.5` (and `c0y` is undefined for this vertex).
                    *   The second vertex is at (62, 63) with `c0x=62.2`, `c0y=63.3` (and `c1x`, `c1y` are undefined for this vertex).
            *   Child Element `<PrimList>`: A string defining geometric primitives using indices into the parsed `VertList`. Primitives are concatenated without spaces, e.g., `L0 1B1 2`.
                *   `L<idx0> <idx1>`: A line segment from `VertList[idx0]` to `VertList[idx1]`.
                *   `B<idx0> <idx1>`: A cubic Bezier curve segment from `VertList[idx0]` to `VertList[idx1]`.
                    *   It uses `(VertList[idx0].c0x, VertList[idx0].c0y)` as the first control point.
                    *   It uses `(VertList[idx1].c1x, VertList[idx1].c1y)` as the second control point.
                *   Other primitives like `Q` (quadratic Bezier) or `C` (alternative cubic) might exist.
        *   For `Type="Group"`:
            *   This shape type represents a collection of other shapes.
            *   Child Element `<Children>`: This element acts as a container for one or more nested `<Shape>` elements that belong to this group.
                *   Example:
                    ```xml
                    <Shape Type="Group" CutIndex="0">
                        <XForm>1 0 0 1 10 10</XForm> <!-- Group's transform -->
                        <Children>
                            <Shape Type="Rect" W="5" H="5" CutIndex="0">
                                <XForm>1 0 0 1 2 2</XForm> <!-- Child's transform relative to group -->
                            </Shape>
                            <Shape Type="Ellipse" Rx="3" Ry="3" CutIndex="0">
                                <XForm>1 0 0 1 -2 -2</XForm> <!-- Another child's transform -->
                            </Shape>
                        </Children>
                    </Shape>
                    ```
            *   The group's own `<XForm>` is applied to all its children. Each child shape then has its own `<XForm>` which is relative to the group's transformed coordinate system.
            *   When converting to SVG:
                *   If a group contains only a single child, its transform is typically composed (multiplied) with the child's transform, and the child is rendered directly with the combined transform.
                *   If a group contains multiple children, it's usually converted to an SVG `<g>` element, with the group's `<XForm>` applied to the `<g>`. The children are then rendered inside this `<g>` with their own respective transforms.
*   `<Notes>`: (User notes, can be ignored for geometry)

Example Structure (derived from `square.lbrn2` artifact):

```xml
<LightBurnProject AppVersion="1.7.08" FormatVersion="1">
    <!-- ... other elements like Thumbnail, VariableText, UIPrefs ... -->
    <CutSetting type="Cut">
        <index Value="0"/>
        <name Value="C00"/>
        <!-- ... other cut parameters ... -->
    </CutSetting>
    <Shape Type="Rect" CutIndex="0" W="10" H="10" Cr="0">
        <XForm>1 0 0 1 55 55</XForm> <!-- Scale(1,1), Translate(55,55) -->
    </Shape>
    <!-- ... other shapes ... -->
    <Notes ShowOnLoad="0" Notes=""/>
</LightBurnProject>
```

Shape Representation in Detail:

*   **`<XForm>`**: The 6 values `a b c d e f` correspond to the matrix:
    ```
    [ a  c  e ]
    [ b  d  f ]
    [ 0  0  1 ]
    ```
    A point `(x_local, y_local)` in the shape's local coordinate system is transformed to `(x_project, y_project)` in the project's coordinate system by:
    `x_project = a * x_local + c * y_local + e`
    `y_project = b * x_local + d * y_local + f`
    LightBurn's coordinate system typically has Y increasing upwards.

*   **Rectangle (`Type="Rect"`)**:
    *   Defined by `W` (width) and `H` (height). `Cr` for corner radius.
    *   Local coordinates are often `x` from `-W/2` to `W/2`, `y` from `-H/2` to `H/2`.
    *   Example: `<Shape Type="Rect" W="10" H="10" Cr="0"><XForm>1 0 0 1 55 55</XForm></Shape>`
      This represents a 10x10 square centered at (55,55) in project coordinates.

*   **Ellipse (`Type="Ellipse"`)**:
    *   Defined by `Rx` (radius X) and `Ry` (radius Y).
    *   Local coordinates are often such that the ellipse equation is `(x/Rx)^2 + (y/Ry)^2 = 1`.
    *   Example: `<Shape Type="Ellipse" Rx="5" Ry="5"><XForm>1 0 0 1 55 55</XForm></Shape>`
      This represents a circle with radius 5, centered at (55,55).

*   **Path (`Type="Path"`)**:
    *   `<VertList>`: Contains vertex data. Each vertex entry starts with `V<x> <y>`.
        *   The characters immediately following `V<x> <y>` (until the next `V` or the end of the `VertList` string) constitute the control point data string for that vertex.
        *   This control point data string is a concatenation of keys like `c0x`, `c0y`, `c1x`, `c1y`, each immediately followed by its numeric value. For example, `c0x12.5c0y-4.5` means control point 0 has x=12.5 and y=-4.5.
        *   Not all four control point components (`c0x`, `c0y`, `c1x`, `c1y`) need to be present for a given vertex.
        *   Example: `V49 48c0x1.5c1x49.5c1y47.5V62 63c0x62.2c0y63.3`
            *   The first vertex is at (49, 48) with `c0x=1.5`, `c1x=49.5`, `c1y=47.5` (and `c0y` is undefined for this vertex).
            *   The second vertex is at (62, 63) with `c0x=62.2`, `c0y=63.3` (and `c1x`, `c1y` are undefined for this vertex).
    *   `<PrimList>`: Defines geometric primitives using indices into the parsed `VertList`. Example: `L0 1` means a line segment from the 0th vertex to the 1st vertex. `B0 1` means a Bezier curve from vertex 0 to vertex 1, using control points defined in their respective `VertList` entries.

Parsing Considerations

XML Parsing: LBRN2 can be parsed using standard XML libraries.
Key Steps for Geometric Conversion:
1.  Load the XML and parse `<LightBurnProject>`.
2.  Iterate through `<Shape>` elements.
3.  For each `<Shape>`:
    *   Identify `Type`.
    *   Extract geometric attributes (W, H, Rx, Ry, etc.).
    *   Parse the `<XForm>` string into a 6-element matrix `[a,b,c,d,e,f]`.
    *   If `Type="Path"`, parse `<VertList>` into an array of coordinate pairs and `<PrimList>` into a sequence of drawing commands.

Challenges:
*   The exact meaning of all possible key-value pairs in the `c...` data string within `<VertList>` and all possible `PrimList` commands (e.g., `Q`, `C` if they differ from `B`) would require more extensive reverse-engineering or documentation.
*   The current implementation focuses on `L` (line) and `B` (cubic Bezier) primitives, and `c0x,c0y,c1x,c1y` control point keys.

SVG Specification Overview
(This part of the original document is largely accurate and can be kept as is, focusing on standard SVG elements like `<rect>`, `<circle>`, `<path>`, `<svg>`, transformations, etc.)

Comparison of LBRN2 and SVG
(This part of the original document is largely accurate. Key updates based on refined LBRN2 understanding):

Aspect LBRN2 SVG
...
Shape Representation: Attributes on `<Shape>` (W, H, Rx, Ry) and child elements like `<XForm>`, `<VertList>`, `<PrimList>`. Standard SVG elements with attributes (`x`, `y`, `width`, `height`, `cx`, `cy`, `r`, `d`, `transform`).
Human Readability: `<XForm>` matrix less immediately readable than SVG's `transform="translate(...) scale(...)"` but more concise. `VertList`/`PrimList` is custom.

Implications for Parsing & Conversion to SVG

LBRN2 to SVG:
1.  **Coordinate System**: SVG's default Y-axis increases downwards, opposite to LightBurn's typical Y-up. The transformation matrix from `<XForm> [a,b,c,d,e,f]` needs to be adapted for SVG. If `(x_svg, y_svg)` are the final coordinates in an SVG system where Y is flipped relative to LBRN2:
    `x_svg = a*x_local + c*y_local + e`
    `y_svg = -(b*x_local + d*y_local + f)`
    This means the SVG transform matrix becomes `matrix(a, -b, c, -d, e, -f)`.
2.  **Shape Mapping**:
    *   LBRN2 `<Shape Type="Rect">` to SVG `<rect>`.
        *   LBRN2 `W`, `H`. SVG `width`, `height`.
        *   LBRN2 local origin (center) to SVG `<rect x="-W/2" y="-H/2" ...>`.
        *   LBRN2 `Cr` to SVG `rx`, `ry`.
    *   LBRN2 `<Shape Type="Ellipse">` to SVG `<circle>` (if Rx=Ry) or `<ellipse>`.
        *   LBRN2 `Rx`, `Ry`. SVG `r` (for circle) or `rx`, `ry` (for ellipse).
        *   LBRN2 local origin (center) to SVG `<circle cx="0" cy="0" ...>` or `<ellipse cx="0" cy="0" ...>`.
    *   LBRN2 `<Shape Type="Path">` to SVG `<path>`.
        *   Parse `VertList` and `PrimList`.
        *   `L<idx0> <idx1>` in `PrimList` becomes `M vert[idx0].x,vert[idx0].y L vert[idx1].x,vert[idx1].y` in SVG path data `d` (if it's the start of a subpath, otherwise just `L`).
        *   `B<idx0> <idx1>` in `PrimList` becomes `C vert[idx0].c0x,vert[idx0].c0y vert[idx1].c1x,vert[idx1].c1y vert[idx1].x,vert[idx1].y` in SVG path data `d`. (Prepended with `M` if it's the start of a subpath).
        *   If a path closes on itself (e.g. last primitive's endpoint is the first primitive's start point), a `Z` is appended to the SVG path data.
3.  **SVG Structure**:
    *   An overall `<svg>` tag with `width`, `height`, and `viewBox`.
    *   The `viewBox` is calculated to encompass all transformed shapes. First, the overall bounding box of all content is determined in LightBurn's coordinate system (where the Y-axis typically points upwards), resulting in `minX, minY, maxX, maxY` values.
    *   The SVG `viewBox` attribute is then set to a string `"${minX} ${minY} ${width} ${height}"`, where `width = maxX - minX` and `height = maxY - minY`.
    *   The `width` and `height` attributes of the `<svg>` element are typically set to `"${width}mm"` and `"${height}mm"` respectively.
    *   The individual shape transformations (e.g., `matrix(a, -b, c, -d, e, -f)`) correctly map the shapes from LightBurn's Y-up system to SVG's Y-down system within this defined `viewBox`.
    *   SVG `width` and `height` attributes often match `viewBox_width`, `viewBox_height` with units (e.g., "mm").
4.  **Styling**: SVG elements will need `fill`, `stroke`, `stroke-width`. These can be default values (e.g., `fill="none" stroke="black" stroke-width="0.05mm"`) if not derived from LBRN2 `CutSetting`.

Guidance for Implementing a Parser
(Python examples can be replaced with TypeScript examples if desired, or kept generic.)
