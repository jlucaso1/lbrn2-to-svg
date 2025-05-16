import type { Lbrn2CutSetting } from "./lbrn2Types";

const DEFAULT_COLORS = [
  "#000000",
  "#FF0000",
  "#00AA00",
  "#0000FF",
  "#FF9900",
  "#9900FF",
  "#00AAAA",
  "#AAAA00",
];

export function getCutSettingStyle(
  cutIndex: number,
  cutSettings: Lbrn2CutSetting[] | undefined
): string {
  if (!cutSettings || cutSettings.length === 0) {
    return `stroke:#000000;stroke-width:0.050000mm;fill:none`;
  }
  const cs = cutSettings.find((cs) => cs.index === cutIndex);
  let color = "#000000";
  let strokeWidth = "0.050000mm";
  if (cs && cs.color) {
    color = cs.color;
  } else if (cs) {
    const paletteIdx =
      typeof cs.index === "number" && cs.index >= 0
        ? cs.index % DEFAULT_COLORS.length
        : 0;
    color = DEFAULT_COLORS[paletteIdx] || "#000000";
  }
  if (cs && cs.strokeWidth) {
    strokeWidth = cs.strokeWidth;
  }
  return `stroke:${color};stroke-width:${strokeWidth};fill:none`;
}