import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma } from "../../src/db/prisma.js";
import { createApp } from "../../src/app.js";
import { createSession } from "../../src/services/auth/session.js";
import { parseCourseZip, type ImportPlan } from "../../src/services/teach/course-import.js";
import { loadChapterReader } from "../../src/services/chapters/reader.js";
import { readReleaseContent } from "../../src/services/courses/releases.js";
import type { CourseUpdatePreview } from "../../src/shared/api/teach.js";

// A course without lesson keys: lessons are known only by their public address.
vi.mock("../../src/services/teach/course-import.js", async importOriginal => ({
  ...await importOriginal<typeof import("../../src/services/teach/course-import.js")>(), parseCourseZip: vi.fn(),
}));

const app = createApp();
const sceneText = "A small shop takes orders by phone and loses some of them. Read how the owner noticed the gap and what the team wrote down first.";
const summaryText = "This lesson sums up the whole build in one page. Create the bucket, then the table, then the queue, and check each one at the end.";
const gateText = "Tick each line when it is true for your build. The bucket exists, the table answers, and the queue holds one note per file.";
const partOneText = "Start with the bucket. Say why a file needs a home before anything else, run the first command, and read the answer it prints back.";
const partTwoText = "Now the queue. Each new file leaves a note, so the worker can stop and start again without losing any of the work it was given.";
const lesson = (lessonNum: number, slugPart: string, title: string, source: string): ImportPlan["modules"][number]["lessons"][number] => ({
  title, source, blocks: [], lessonNum, slugPart, summary: null, estimatedMinutes: 10, readerMode: "DEFAULT", isMilestone: false,
});
const manifest = { title: "Build", description: "Build", projectGoal: "Build", difficulty: "beginner", estimatedHours: 1 };
const guided = (): ImportPlan["modules"] => [{ title: "Build it", lessons: [
  lesson(1, "set-the-scene", "Set the scene", sceneText),
  lesson(2, "part-1-the-bucket", "Part 1: the bucket", partOneText),
  lesson(3, "part-2-the-queue", "Part 2: the queue", partTwoText),
  lesson(4, "checklist", "Checklist", gateText),
] }];

let owner: Awaited<ReturnType<typeof prisma.user.create>>;
let learner: typeof owner;
let course: Awaited<ReturnType<typeof prisma.course.create>>;
let token = "";
let currentPlan: ImportPlan;
const headers = () => ({ Authorization: `Bearer ${token}` });
const endpoint = () => `/api/v1/teach/courses/${course.id}/import`;

beforeEach(async () => {
  const tag = randomUUID();
  owner = await prisma.user.create({ data: { email: `rm-owner-${tag}@test.local`, role: "MENTOR", emailVerified: new Date(), zipImportEnabled: true } });
  learner = await prisma.user.create({ data: { email: `rm-learner-${tag}@test.local`, role: "MENTEE", emailVerified: new Date() } });
  course = await prisma.course.create({ data: { slug: `rm-address-${tag}`, title: "Build", mentorId: owner.id, status: "PUBLISHED", publishedAt: new Date() } });
  const module = await prisma.module.create({ data: { courseId: course.id, title: "Build it", order: 1 } });
  const rows = [["1-1-set-the-scene", "Set the scene", sceneText], ["1-2-the-whole-build", "The whole build", summaryText], ["1-3-checklist", "Checklist", gateText]];
  for (const [index, [slug, title, source]] of rows.entries()) {
    await prisma.chapter.create({ data: { courseId: course.id, moduleId: module.id, title, slug, source, compiled: source, order: index + 1, publishedAt: new Date(), estimatedMinutes: 10 } });
  }
  await prisma.enrollment.create({ data: { courseId: course.id, userId: learner.id, lifecycle: "ACTIVE" } });
  token = (await createSession(owner.id)).sessionToken;
  currentPlan = { manifest, modules: guided() };
  vi.mocked(parseCourseZip).mockImplementation(async () => ({ slug: course.slug, plan: structuredClone(currentPlan) }));
});

afterEach(async () => {
  if (course) await prisma.course.delete({ where: { id: course.id } });
  if (owner) await prisma.user.deleteMany({ where: { id: { in: [owner.id, learner.id] } } });
});

async function preview() {
  const result = await request(app).post(`${endpoint()}/preview`).set(headers()).set("Content-Type", "application/zip").send(Buffer.from("test package"));
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.data as CourseUpdatePreview;
}
async function approve(previewId: string) {
  return request(app).post(`${endpoint()}/approve`).set(headers()).send({ previewId, confirm: true });
}
async function activeSlugs() {
  const { activeReleaseId } = await prisma.course.findUniqueOrThrow({ where: { id: course.id }, select: { activeReleaseId: true } });
  const content = readReleaseContent((await prisma.courseRelease.findUniqueOrThrow({ where: { id: activeReleaseId! } })).content);
  return { slugs: content.variants.default!.flatMap(module => module.chapters.map(chapter => chapter.slug)), redirects: content.redirects };
}
const reader = (slug: string) => loadChapterReader(course.slug, slug, { id: learner.id, email: learner.email, role: "MENTEE" } as Parameters<typeof loadChapterReader>[2]);

describe("removing a lesson by its address", () => {
  it("keeps a lesson that the package leaves out", async () => {
    expect((await approve((await preview()).previewId)).status).toBe(200);
    expect((await activeSlugs()).slugs).toContain("1-2-the-whole-build");
  });

  it("removes a named lesson, sends its address to the replacement and changes nothing on a second publish", async () => {
    currentPlan.remove = { moduleKeys: [], lessonKeys: [], lessons: [{ slug: "1-2-the-whole-build", redirectTo: "1-2-part-1-the-bucket" }] };
    const diff = await preview();
    expect(diff.modules.filter(module => module.action === "removed").map(module => module.title)).toEqual(["The whole build"]);
    expect((await approve(diff.previewId)).status).toBe(200);
    const after = await activeSlugs();
    // The checklist kept its address (matched by content) and its new place in the order.
    expect(after.slugs).toEqual(["1-1-set-the-scene", "1-2-part-1-the-bucket", "1-3-part-2-the-queue", "1-3-checklist"]);
    expect(after.redirects).toEqual({ "1-2-the-whole-build": "1-2-part-1-the-bucket" });

    const view = await reader("1-2-the-whole-build");
    expect(view.chapter.slug).toBe("1-2-part-1-the-bucket");
    expect(view.chapter.lessonLabel).toBe("01.02");
    expect(view.modules.flatMap(module => module.chapters).map(chapter => chapter.title)).not.toContain("The whole build");
    expect((await reader("1-3-checklist")).chapter.lessonLabel).toBe("01.04");
    await expect(reader("1-9-never-existed")).rejects.toThrow("Chapter not found");

    // The removal stays in course.yaml: the next publish finds nothing to do.
    const releases = await prisma.courseRelease.count({ where: { courseId: course.id } });
    const again = await preview();
    expect(again.modules.some(module => module.action === "removed")).toBe(false);
    expect((await approve(again.previewId)).status).toBe(200);
    expect(await prisma.courseRelease.count({ where: { courseId: course.id } })).toBe(releases);
  });

  it("removes a lesson without a redirect", async () => {
    currentPlan.remove = { moduleKeys: [], lessonKeys: [], lessons: [{ slug: "1-2-the-whole-build" }] };
    expect((await approve((await preview()).previewId)).status).toBe(200);
    const after = await activeSlugs();
    expect(after.slugs).not.toContain("1-2-the-whole-build");
    expect(after.redirects).toBeUndefined();
    await expect(reader("1-2-the-whole-build")).rejects.toThrow("Chapter not found");
  });

  it("refuses a redirect to a lesson that is not in the course, and a lesson that is both removed and supplied", async () => {
    currentPlan.remove = { moduleKeys: [], lessonKeys: [], lessons: [{ slug: "1-2-the-whole-build", redirectTo: "1-7-nowhere" }] };
    const missing = await approve((await preview()).previewId);
    expect(missing.status).toBe(400);
    expect(JSON.stringify(missing.body)).toContain("not in the course");
    currentPlan.remove = { moduleKeys: [], lessonKeys: [], lessons: [{ slug: "1-2-part-1-the-bucket" }] };
    const both = await approve((await preview()).previewId);
    expect(both.status).toBe(400);
    expect(JSON.stringify(both.body)).toContain("Cannot remove and update");
    // A refused publish leaves the course as it was.
    expect(await prisma.courseRelease.count({ where: { courseId: course.id } })).toBe(0);
    expect(await prisma.chapter.count({ where: { courseId: course.id } })).toBe(3);
  });
});
