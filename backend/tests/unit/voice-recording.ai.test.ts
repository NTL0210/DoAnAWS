import { describe, expect, it } from "vitest";
import {
  calculateTaskConfidence,
  decodeTranscriptBuffer,
  detectTranscriptLanguage,
  filterActionableTaskCandidates,
  isActionableTaskCandidate,
  normalizeStartDate,
  normalizeTranscriptText,
} from "../../src/modules/voice-recordings/voice-recording.ai.js";

const transcript = [
  "[Luc] An fix refresh token truoc thu Sau, xong ping anh review.",
  "[Minh] Cho em hoi giu WebSocket dung khong?",
  "[Luc] Minh nghien cuu ghi audio LiveKit va demo tuan sau.",
  "[Ha] Em cap quyen S3 va tao budget alert trong hom nay.",
  "[An] Phan login em lam gan xong roi.",
  "[Luc] VNPay de sprint sau, tap trung voice va login da.",
].join("\n");

describe("voice task candidate filtering", () => {
  it("keeps explicit assignments and removes questions, updates, and decisions", () => {
    expect(isActionableTaskCandidate({ sourceQuote: "An fix refresh token truoc thu Sau, xong ping anh review." }, transcript)).toBe(true);
    expect(isActionableTaskCandidate({ sourceQuote: "Minh nghien cuu ghi audio LiveKit va demo tuan sau." }, transcript)).toBe(true);
    expect(isActionableTaskCandidate({ sourceQuote: "Em cap quyen S3 va tao budget alert trong hom nay." }, transcript)).toBe(true);

    expect(isActionableTaskCandidate({ sourceQuote: "Cho em hoi giu WebSocket dung khong?" }, transcript)).toBe(false);
    expect(isActionableTaskCandidate({ sourceQuote: "Phan login em lam gan xong roi." }, transcript)).toBe(false);
    expect(isActionableTaskCandidate({ sourceQuote: "VNPay de sprint sau, tap trung voice va login da." }, transcript)).toBe(false);
  });

  it("does not retain duplicate or unsupported task suggestions", () => {
    const tasks = filterActionableTaskCandidates([
      { title: "Fix refresh token", sourceQuote: "An fix refresh token truoc thu Sau, xong ping anh review." },
      { title: "Fix refresh token", sourceQuote: "An fix refresh token truoc thu Sau, xong ping anh review." },
      { title: "Invented task", sourceQuote: "Implement mobile application redesign." },
    ], transcript);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("Fix refresh token");
  });
});

describe("transcript encoding and language", () => {
  it("preserves UTF-8 Vietnamese text and repairs common mojibake", () => {
    expect(decodeTranscriptBuffer(Buffer.from("Cu\u1ed9c h\u1ecdp", "utf8"))).toBe("Cu\u1ed9c h\u1ecdp");
    expect(normalizeTranscriptText("caf\u00c3\u00a9")).toBe("caf\u00e9");
  });

  it("selects the output language from the transcript language", () => {
    expect(detectTranscriptLanguage("H\u00e3y giao Minh fix dang nhap truoc thu Sau.")).toBe("Vietnamese");
    expect(detectTranscriptLanguage("Please assign Minh to fix login before Friday.")).toBe("English");
  });
});

describe("suggested task verification", () => {
  const datedTranscript = "[Luc] An bat dau fix refresh token tu ngay 2026-07-18 va hoan thanh truoc thu Sau.";

  it("keeps an evidenced start date and scores explicit delegation above review threshold", () => {
    const sourceQuote = "An bat dau fix refresh token tu ngay 2026-07-18 va hoan thanh truoc thu Sau.";
    expect(normalizeStartDate("2026-07-18", sourceQuote, datedTranscript, "2026-07-16")).toBe("2026-07-18");
    expect(calculateTaskConfidence({
      title: "Fix refresh token",
      description: sourceQuote,
      assignee: "An",
      startDate: "2026-07-18",
      deadline: "2026-07-17",
      sourceQuote,
    }, datedTranscript)).toBeGreaterThanOrEqual(0.8);
  });

  it("gives no confidence to an unsupported task", () => {
    expect(calculateTaskConfidence({
      title: "Build mobile redesign",
      description: "Build mobile redesign",
      assignee: "",
      startDate: "",
      deadline: "",
      sourceQuote: "Build mobile redesign",
    }, transcript)).toBe(0);
  });
});
