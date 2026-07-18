import { describe, expect, it } from "vitest";
import {
  calculateTaskConfidence,
  decodeTranscriptBuffer,
  detectTranscriptLanguage,
  extractExplicitResponsibilityTasks,
  filterActionableTaskCandidates,
  isActionableTaskCandidate,
  isUsefulSummary,
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

describe("coordinated Vietnamese responsibility assignments", () => {
  it("creates a separate high-priority task for self backend and named frontend ownership", () => {
    const assignmentTranscript = "Em s\u1ebd th\u1eed t\u00ednh n\u0103ng AI n\u00e0y. Em s\u1ebd ph\u00e2n c\u00f4ng c\u00f4ng vi\u1ec7c cho em l\u00e0 backend, c\u00f2n b\u1ea1n \u0110\u1ee9c s\u1ebd l\u00e0 frontend v\u1edbi m\u1ee9c \u0111\u1ed9 \u01b0u ti\u00ean l\u00e0 high.";
    const tasks = extractExplicitResponsibilityTasks(assignmentTranscript);

    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.assignee)).toEqual(["SELF", "\u0110\u1ee9c"]);
    expect(tasks.map((task) => task.title)).toEqual(["Ph\u1ee5 tr\u00e1ch backend", "Ph\u1ee5 tr\u00e1ch frontend"]);
    expect(tasks.every((task) => task.priority === "HIGH")).toBe(true);
    expect(isActionableTaskCandidate({
      title: "Phu trach frontend",
      assignee: "Duc",
      sourceQuote: "ban Duc se la frontend",
    }, assignmentTranscript)).toBe(true);
  });

  it("keeps only the newest assignee after an explicit correction", () => {
    const transcript = "Lúc nãy nói Đức làm frontend nhưng thôi để Lan làm luôn.";
    const tasks = extractExplicitResponsibilityTasks(transcript);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      assignee: "Lan",
      title: "Phụ trách frontend",
      reason: "Giữ phân công mới nhất sau khi người nói sửa lại",
    });
  });

  it("applies a later reassignment across separate sentences", () => {
    const transcript = "Đức làm frontend. Thôi, đổi lại để chị Lan làm frontend.";
    const tasks = extractExplicitResponsibilityTasks(transcript);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.assignee).toBe("Lan");
  });
});

describe("supplemental extraction rules", () => {
  it("accepts team ownership and process tasks", () => {
    const transcript = "Cả team backend sẽ review lại API. Lan nhớ note lại vào docs và tạo ticket Jira.";

    expect(isActionableTaskCandidate({
      title: "Review API",
      assignee: "team backend",
      sourceQuote: "Cả team backend sẽ review lại API.",
    }, transcript)).toBe(true);
    expect(isActionableTaskCandidate({
      title: "Update docs",
      assignee: "Lan",
      sourceQuote: "Lan nhớ note lại vào docs và tạo ticket Jira.",
    }, transcript)).toBe(true);
  });

  it("ignores statements with an explicit joke cue", () => {
    const transcript = "Lan làm frontend nhé [cười].";
    expect(isActionableTaskCandidate({
      title: "Phụ trách frontend",
      assignee: "Lan",
      sourceQuote: transcript,
    }, transcript)).toBe(false);
  });

  it("caps confidence when STT marks evidence as unclear", () => {
    const transcript = "Lan handle authentication [unclear].";
    const confidence = calculateTaskConfidence({
      title: "Handle authentication",
      description: "Lan handle authentication.",
      assignee: "Lan",
      priority: "MEDIUM",
      startDate: "",
      deadline: "",
      confidence: 0,
      sourceQuote: transcript,
      reason: "STT may be unclear",
    }, transcript);

    expect(confidence).toBeLessThanOrEqual(0.55);
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

describe("meeting summary quality", () => {
  it("keeps a concise synthesized summary for a short Vietnamese transcript", () => {
    const shortTranscript = "Minh phu trach backend. Duc phu trach frontend. Ca hai uu tien cao.";
    expect(isUsefulSummary(
      "Cuoc hop phan cong Minh phu trach backend va Duc phu trach frontend, ca hai deu co muc uu tien cao.",
      shortTranscript,
    )).toBe(true);
  });

  it("rejects a verbatim transcript presented as its own summary", () => {
    const shortTranscript = "Minh phu trach backend. Duc phu trach frontend.";
    expect(isUsefulSummary(shortTranscript, shortTranscript)).toBe(false);
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
