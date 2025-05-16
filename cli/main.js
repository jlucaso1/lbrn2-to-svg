#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { lbrn2ToSvg, parseLbrn2 } from "lbrn2-to-svg";

function printUsage() {
  console.log("Usage: <input.lbrn2> <output.svg>");
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }
  const [inputPath, outputPath] = args;
  if (!inputPath || !outputPath) {
    printUsage();
    process.exit(1);
  }
  let xml;
  try {
    xml = readFileSync(inputPath, "utf-8");
  } catch (e) {
    console.error(`Failed to read input file: ${inputPath}`);
    process.exit(2);
  }
  let project;
  try {
    project = parseLbrn2(xml);
  } catch (e) {
    console.error("Failed to parse LBRN2 file:", e);
    process.exit(3);
  }
  let svg;
  try {
    svg = lbrn2ToSvg(project);
  } catch (e) {
    console.error("Failed to convert to SVG:", e);
    process.exit(4);
  }
  try {
    writeFileSync(outputPath, svg, "utf-8");
  } catch (e) {
    console.error(`Failed to write output file: ${outputPath}`);
    process.exit(5);
  }
  console.log(`SVG written to ${outputPath}`);
}

main();
