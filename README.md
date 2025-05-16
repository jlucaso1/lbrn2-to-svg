# LBRN2 to SVG Converter (`lbrn2-to-svg`)

[![NPM Version](https://img.shields.io/npm/v/lbrn2-to-svg.svg?style=flat)](https://www.npmjs.com/package/lbrn2-to-svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript library and command-line interface (CLI) to parse LightBurn LBRN2 project files and convert their 2D vector shapes to Scalable Vector Graphics (SVG) format.

This project aims to provide a robust tool for developers needing to work with LBRN2 files programmatically or convert them for use in other applications. It is designed to be compatible with various JavaScript/TypeScript environments, including Node.js, Deno, Bun, and modern web browsers (for the library functionality).

## Features

*   **LBRN2 Parsing:** Parses LBRN2 XML structure into a typed JavaScript object.
*   **SVG Conversion:** Converts supported LBRN2 shapes to their SVG equivalents.
    *   Supported Shapes: `Rect`, `Ellipse`, `Path` (including Lines and Bezier curves), `Group`.
    *   Handles shape transformations (`<XForm>`).
*   **Styling:** Applies basic styling (stroke color) from LBRN2 `<CutSetting>` elements.
*   **CLI Tool:** Provides a command-line interface for easy file conversion.
*   **TypeScript Library:** Offers an ESM library for programmatic integration into your projects.
*   **Cross-Environment:** The core library is designed to be environment-agnostic. The CLI is for server-side environments (Node, Deno, Bun).

## Supported LBRN2 Features

*   **Shapes:**
    *   `<Shape Type="Rect">` (including corner radius `Cr`)
    *   `<Shape Type="Ellipse">` (converts to `<circle>` if `Rx` equals `Ry`)
    *   `<Shape Type="Path">`
        *   `<VertList>` (vertex coordinates and control points `c0x, c0y, c1x, c1y`)
        *   `<PrimList>` (primitives: `L` for Line, `B` for Bezier)
    *   `<Shape Type="Group">` (with nested shapes and transform composition)
*   **Transformations:** `<XForm>` matrix for each shape and group.
*   **Cut Settings:** Uses `CutIndex` to link shapes to `<CutSetting>` for stroke color. Default colors are used if a color is not explicitly defined in the `CutSetting`.
*   **Coordinate System:** Correctly handles LightBurn's Y-up coordinate system and transforms it to SVG's Y-down system within the calculated `viewBox`.

## Limitations & TODO

*   Currently does not support raster images (`<Image>`), text elements (`<Text>`), or advanced LBRN2 features like variable text.
*   Only basic styling (stroke color, default stroke width) is applied from `CutSetting`. Other laser parameters are ignored.
*   More complex `PrimList` primitives (if any beyond Line and Bezier) are not supported.
*   Error handling for malformed LBRN2 files can be improved.

## Installation

```bash
# Using npm
npm install lbrn2-to-svg

# Using yarn
yarn add lbrn2-to-svg

# Using bun
bun add lbrn2-to-svg
```

## Usage

### Command-Line Interface (CLI)

After installation, you can use the CLI tool:

```bash
npx lbrn2-to-svg <input.lbrn2> <output.svg>
```

Or, if installed globally or as a project dependency with scripts:

```bash
lbrn2-to-svg path/to/your/file.lbrn2 path/to/output/file.svg
```

Example:

```bash
lbrn2-to-svg project.lbrn2 project.svg
# SVG written to project.svg
```

### Programmatic (Library)

You can use the library in your TypeScript or JavaScript (ESM) projects:

```typescript
import { parseLbrn2, lbrn2ToSvg, type LightBurnProjectFile } from 'lbrn2-to-svg';
import fs from 'fs/promises';

async function convertFile(inputPath: string, outputPath: string) {
  try {
    const lbrn2Xml: string = await fs.readFile(inputPath, 'utf-8');
    const project: LightBurnProjectFile = parseLbrn2(lbrn2Xml);
    const svgString: string = lbrn2ToSvg(project);
    await fs.writeFile(outputPath, svgString, 'utf-8');
    console.log(`SVG successfully written to ${outputPath}`);
  } catch (error) {
    console.error('Conversion failed:', error);
  }
}
```

The core parsing and conversion functions (`parseLbrn2`, `lbrn2ToSvg`) are pure and do not rely on Node.js-specific APIs, making them suitable for browser environments if you provide the LBRN2 XML string.

## Development

### Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/jlucaso1/lbrn2-to-svg.git
    cd lbrn2-to-svg
    ```
2.  Install dependencies:
    ```bash
    bun install
    ```

### Building

To compile TypeScript to JavaScript (outputs to `dist` directory):

```bash
bun run build
```

A `tsconfig.json` is included for build configuration.

### Testing

Run tests using Bun:

```bash
bun test
```

Tests use `.lbrn2` and `.svg` artifact files located in `tests/artifacts/`.

### LBRN2 Artifact Minimization

A utility script is provided to minimize the size of `.lbrn2` test artifacts by removing non-essential XML elements and attributes. This helps keep test files focused on the geometric data being tested.

To run the minimizer on files in `tests/artifacts/`:

```bash
bun run scripts/minimize_lbrn2_artifacts.ts
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
For major changes, please open an issue first to discuss what you would like to change.

Ensure to update tests as appropriate.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.