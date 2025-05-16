import { describe, test, expect } from "bun:test";
import { getCutSettingStyle } from "../src/styleUtils";
import type { Lbrn2CutSetting } from "../src/lbrn2Types";

describe("getCutSettingStyle", () => {
  test("returns default style if cutSettings is undefined", () => {
    expect(getCutSettingStyle(0, undefined)).toBe(
      "stroke:#000000;stroke-width:0.050000mm;fill:none"
    );
  });

  test("returns default style if cutSettings is empty", () => {
    expect(getCutSettingStyle(0, [])).toBe(
      "stroke:#000000;stroke-width:0.050000mm;fill:none"
    );
  });

  test("returns style with color and strokeWidth from cutSettings", () => {
    const cs: Lbrn2CutSetting[] = [
      { index: 1, name: "cut1", color: "#123456", strokeWidth: "0.2mm" },
    ];
    expect(getCutSettingStyle(1, cs)).toBe(
      "stroke:#123456;stroke-width:0.2mm;fill:none"
    );
  });

  test("returns style with color from cutSettings and default strokeWidth", () => {
    const cs: Lbrn2CutSetting[] = [
      { index: 2, name: "cut2", color: "#654321" },
    ];
    expect(getCutSettingStyle(2, cs)).toBe(
      "stroke:#654321;stroke-width:0.050000mm;fill:none"
    );
  });

  test("returns style with palette color if color missing", () => {
    const cs: Lbrn2CutSetting[] = [{ index: 3, name: "cut3" }];
    // DEFAULT_COLORS[3] = "#0000FF"
    expect(getCutSettingStyle(3, cs)).toBe(
      "stroke:#0000FF;stroke-width:0.050000mm;fill:none"
    );
  });

  test("returns style with palette color and custom strokeWidth if color missing", () => {
    const cs: Lbrn2CutSetting[] = [
      { index: 4, name: "cut4", strokeWidth: "0.3mm" },
    ];
    // DEFAULT_COLORS[4] = "#FF9900"
    expect(getCutSettingStyle(4, cs)).toBe(
      "stroke:#FF9900;stroke-width:0.3mm;fill:none"
    );
  });

  test("handles negative index gracefully", () => {
    const cs: Lbrn2CutSetting[] = [{ index: -1, name: "cut5" }];
    // Should fallback to DEFAULT_COLORS[0]
    expect(getCutSettingStyle(-1, cs)).toBe(
      "stroke:#000000;stroke-width:0.050000mm;fill:none"
    );
  });

  test("handles cutIndex not matching any cutSettings", () => {
    const cs: Lbrn2CutSetting[] = [
      { index: 0, name: "cut6", color: "#111111" },
    ];
    expect(getCutSettingStyle(99, cs)).toBe(
      "stroke:#000000;stroke-width:0.050000mm;fill:none"
    );
  });
});
