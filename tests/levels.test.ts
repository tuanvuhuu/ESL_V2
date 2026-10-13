// B5: so khớp cấp độ dạy được của giáo viên với cấp độ của khóa.
import { describe, expect, it } from "vitest";
import { levelMatch, parseLevels } from "@/lib/levels";

describe("cấp độ dạy được", () => {
  it("tách danh sách, bỏ trống và trùng", () => {
    expect(parseLevels(" Starters, movers ;  Starters,, ")).toEqual(["Starters", "movers"]);
    expect(parseLevels(null)).toEqual([]);
  });

  it("không phân biệt hoa thường và khoảng trắng thừa", () => {
    expect(levelMatch("Starters, Movers", "movers")).toBe("MATCH");
    expect(levelMatch("A2 – B1", "a2  –  b1")).toBe("MATCH");
  });

  it("khai rồi mà khác cấp độ thì MISMATCH", () => {
    expect(levelMatch("Starters", "KET")).toBe("MISMATCH");
  });

  it("chưa khai hoặc khóa chưa có cấp độ thì UNKNOWN", () => {
    expect(levelMatch(null, "KET")).toBe("UNKNOWN");
    expect(levelMatch("", "KET")).toBe("UNKNOWN");
    expect(levelMatch("KET", null)).toBe("UNKNOWN");
  });
});