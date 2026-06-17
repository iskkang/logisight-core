// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { RatesBrief } from "./RatesBrief";

const sig = { label: "해상 운임 압력", state: "caution" as const, basis: "b", sources: ["KCCI"], asOf: "2026-06-15", confidence: "high" as const };

afterEach(() => cleanup());

describe("RatesBrief prose", () => {
  it("renders AI prose when prose prop present", () => {
    render(<RatesBrief signals={[sig]} asOf="2026-06-15" prose={{ headline: "헤드라인X", ocean: "해상분석Y", global: "g", air: "", outlook: "전망Z" }} />);
    expect(screen.getByText("헤드라인X")).toBeTruthy();
    expect(screen.getByText("해상분석Y")).toBeTruthy();
    expect(screen.getByText(/전망Z/)).toBeTruthy();
  });
  it("falls back to template narration when prose absent", () => {
    render(<RatesBrief signals={[sig]} asOf="2026-06-15" prose={null} />);
    expect(screen.getAllByText(/한국발 해상 운임/).length).toBeGreaterThan(0);
  });
});
