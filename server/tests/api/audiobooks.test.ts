import { randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// An in-memory stand-in for the R2 bucket: put, get (with Range), delete.
const store = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("../../src/services/storage/r2.js", () => ({
  isMissingObjectError: (error: unknown) => error instanceof Error && error.name === "NoSuchKey",
  r2Storage: () => ({
    bucket: "test",
    client: {
      async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
        const name = command.constructor.name;
        const input = command.input as { Key?: string; Body?: Buffer; Range?: string; Delete?: { Objects: { Key: string }[] } };
        if (name === "PutObjectCommand") {
          store.set(input.Key!, input.Body!);
          return {};
        }
        if (name === "DeleteObjectCommand") {
          store.delete(input.Key!);
          return {};
        }
        if (name === "DeleteObjectsCommand") {
          for (const object of input.Delete!.Objects) store.delete(object.Key);
          return {};
        }
        if (name === "GetObjectCommand") {
          const bytes = store.get(input.Key!);
          if (!bytes) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
          const range = input.Range ? /^bytes=(\d*)-(\d*)$/.exec(input.Range) : null;
          if (!range) return { Body: Readable.from(bytes), ContentLength: bytes.length };
          const start = Number(range[1] || 0);
          const end = Math.min(Number(range[2] || bytes.length - 1), bytes.length - 1);
          const slice = bytes.subarray(start, end + 1);
          return { Body: Readable.from(slice), ContentLength: slice.length, ContentRange: `bytes ${start}-${end}/${bytes.length}` };
        }
        throw new Error(`unexpected command ${name}`);
      },
    },
  }),
}));

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/db/prisma.js");
const { createSession } = await import("../../src/services/auth/session.js");

const app = createApp();
const tag = randomUUID().slice(0, 8);
const userIds: string[] = [];
const bookIds: string[] = [];
let owner: { Authorization: string };
let other: { Authorization: string };
let learner: { Authorization: string };
let admin: { Authorization: string };

// A tiny file that passes the MP3 check: an ID3 tag, then padding.
const mp3 = (size = 4000) => Buffer.concat([Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00"), randomBytes(size)]);

async function user(role: "MENTOR" | "MENTEE" | "ADMIN", label: string) {
  const created = await prisma.user.create({ data: { email: `${label}-${tag}@test.local`, name: `${label} ${tag}`, role, emailVerified: new Date() } });
  userIds.push(created.id);
  const session = await createSession(created.id, randomBytes(32).toString("hex"));
  return { Authorization: `Bearer ${session.sessionToken}` };
}

async function createBook(headers: { Authorization: string }, title: string) {
  const response = await request(app).post("/api/v1/teach/audiobooks").set(headers).send({ title });
  expect(response.status).toBe(201);
  bookIds.push(response.body.data.id);
  return response.body.data as { id: string; slug: string };
}

function upload(headers: { Authorization: string }, bookId: string, title: string, file: Buffer, duration = 120) {
  return request(app)
    .post(`/api/v1/teach/audiobooks/${bookId}/tracks`)
    .query({ title, duration })
    .set(headers)
    .set("Content-Type", "audio/mpeg")
    .send(file);
}

beforeAll(async () => {
  owner = await user("MENTOR", "owner");
  other = await user("MENTOR", "other");
  learner = await user("MENTEE", "learner");
  admin = await user("ADMIN", "admin");
});

afterAll(async () => {
  await prisma.audiobook.deleteMany({ where: { id: { in: bookIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("audiobooks", () => {
  it("keeps the instructor routes away from learners and signed-out visitors", async () => {
    expect((await request(app).get("/api/v1/teach/audiobooks")).status).toBe(401);
    expect((await request(app).get("/api/v1/teach/audiobooks").set(learner)).status).toBe(403);
    expect((await request(app).post("/api/v1/teach/audiobooks").set(learner).send({ title: "Nope" })).status).toBe(403);
  });

  it("starts empty: no course narration is listed", async () => {
    const response = await request(app).get("/api/v1/audiobooks");
    expect(response.status).toBe(200);
    expect(response.body.data.audiobooks.filter((book: { title: string }) => book.title.includes(tag))).toEqual([]);
  });

  it("runs the whole life of a book: draft, upload, publish, listen, unpublish, delete", async () => {
    const book = await createBook(owner, `Deep Work ${tag}`);
    expect(book.slug).toMatch(/^deep-work-/);

    // A draft is invisible to learners, and cannot be published while empty.
    expect((await request(app).get(`/api/v1/audiobooks/${book.slug}`)).status).toBe(404);
    expect((await request(app).post(`/api/v1/teach/audiobooks/${book.id}/publish`).set(owner)).status).toBe(400);

    const first = mp3(5000);
    const added = await upload(owner, book.id, "Chapter one", first, 90);
    expect(added.status).toBe(201);
    expect((await upload(owner, book.id, "Chapter two", mp3(), 60)).status).toBe(201);
    const withTracks = await request(app).get(`/api/v1/teach/audiobooks/${book.id}`).set(owner);
    const tracks = withTracks.body.data.tracks as { id: string; title: string; position: number; src: string }[];
    expect(tracks.map((track) => [track.title, track.position])).toEqual([["Chapter one", 1], ["Chapter two", 2]]);
    expect(withTracks.body.data.totalSeconds).toBe(150);

    // The owner can preview a draft's audio; the public cannot.
    expect((await request(app).get(tracks[0]!.src)).status).toBe(404);
    const preview = await request(app).get(tracks[0]!.src).set(owner);
    expect(preview.status).toBe(200);
    expect(preview.headers["cache-control"]).toBe("private, no-store");

    expect((await request(app).post(`/api/v1/teach/audiobooks/${book.id}/publish`).set(owner)).status).toBe(200);

    const list = await request(app).get("/api/v1/audiobooks");
    expect(list.body.data.audiobooks.map((entry: { slug: string }) => entry.slug)).toContain(book.slug);
    const detail = await request(app).get(`/api/v1/audiobooks/${book.slug}`);
    expect(detail.body.data).toMatchObject({ title: `Deep Work ${tag}`, totalSeconds: 150 });
    expect(detail.body.data).not.toHaveProperty("id");

    // Anyone can stream a published track, including a byte range for seeking.
    const whole = await request(app).get(tracks[0]!.src).buffer(true).parse((res, done) => {
      const parts: Buffer[] = [];
      res.on("data", (chunk: Buffer) => parts.push(chunk));
      res.on("end", () => done(null, Buffer.concat(parts)));
    });
    expect(whole.status).toBe(200);
    expect(whole.headers["content-type"]).toBe("audio/mpeg");
    expect(whole.headers["accept-ranges"]).toBe("bytes");
    expect(Buffer.compare(whole.body as Buffer, first)).toBe(0);
    const part = await request(app).get(tracks[0]!.src).set("Range", "bytes=10-19");
    expect(part.status).toBe(206);
    expect(part.headers["content-range"]).toBe(`bytes 10-19/${first.length}`);
    expect(part.headers["content-length"]).toBe("10");

    // Unpublishing takes it off the shelf and closes the audio at once.
    expect((await request(app).post(`/api/v1/teach/audiobooks/${book.id}/unpublish`).set(owner)).status).toBe(200);
    expect((await request(app).get(`/api/v1/audiobooks/${book.slug}`)).status).toBe(404);
    expect((await request(app).get(tracks[0]!.src)).status).toBe(404);

    expect((await request(app).delete(`/api/v1/teach/audiobooks/${book.id}`).set(owner)).status).toBe(204);
    expect(await prisma.audiobookTrack.count({ where: { audiobookId: book.id } })).toBe(0);
    expect([...store.keys()].filter((key) => key.startsWith(`audiobooks/${book.id}/`))).toEqual([]);
  });

  it("lets only the owner or an admin change a book", async () => {
    const book = await createBook(owner, `Private ${tag}`);
    expect((await request(app).get(`/api/v1/teach/audiobooks/${book.id}`).set(other)).status).toBe(403);
    expect((await request(app).patch(`/api/v1/teach/audiobooks/${book.id}`).set(other).send({ title: "Mine now" })).status).toBe(403);
    expect((await upload(other, book.id, "Sneaky", mp3())).status).toBe(403);
    expect((await request(app).delete(`/api/v1/teach/audiobooks/${book.id}`).set(other)).status).toBe(403);

    const list = await request(app).get("/api/v1/teach/audiobooks").set(other);
    expect(list.body.data.audiobooks.map((entry: { id: string }) => entry.id)).not.toContain(book.id);

    const adminEdit = await request(app).patch(`/api/v1/teach/audiobooks/${book.id}`).set(admin).send({ authorName: "Edorax Team" });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.data.authorName).toBe("Edorax Team");
  });

  it("refuses files that are not MP3 and oversized or missing details", async () => {
    const book = await createBook(owner, `Uploads ${tag}`);
    expect((await upload(owner, book.id, "Text", Buffer.from("this is not audio at all"))).status).toBe(400);
    expect((await request(app).post(`/api/v1/teach/audiobooks/${book.id}/tracks`).query({ duration: 10 }).set(owner).set("Content-Type", "audio/mpeg").send(mp3())).status).toBe(400);
    expect((await request(app).post(`/api/v1/teach/audiobooks/${book.id}/tracks`).query({ title: "No length" }).set(owner).set("Content-Type", "audio/mpeg").send(mp3())).status).toBe(400);
    expect((await request(app).post(`/api/v1/teach/audiobooks/${book.id}/tracks`).query({ title: "Wrong type", duration: 10 }).set(owner).set("Content-Type", "audio/wav").send(mp3())).status).toBe(400);
    expect(await prisma.audiobookTrack.count({ where: { audiobookId: book.id } })).toBe(0);
  });

  it("reorders, renames and removes chapters, keeping positions 1..n", async () => {
    const book = await createBook(owner, `Order ${tag}`);
    for (const title of ["A", "B", "C"]) expect((await upload(owner, book.id, title, mp3(), 30)).status).toBe(201);
    const ids = ((await request(app).get(`/api/v1/teach/audiobooks/${book.id}`).set(owner)).body.data.tracks as { id: string }[]).map((track) => track.id);

    const reordered = await request(app).put(`/api/v1/teach/audiobooks/${book.id}/tracks/order`).set(owner).send({ trackIds: [ids[2], ids[0], ids[1]] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data.tracks.map((track: { title: string }) => track.title)).toEqual(["C", "A", "B"]);
    expect((await request(app).put(`/api/v1/teach/audiobooks/${book.id}/tracks/order`).set(owner).send({ trackIds: [ids[0]] })).status).toBe(400);

    const renamed = await request(app).patch(`/api/v1/teach/audiobooks/${book.id}/tracks/${ids[0]}`).set(owner).send({ title: "A, revised" });
    expect(renamed.body.data.tracks.map((track: { title: string }) => track.title)).toEqual(["C", "A, revised", "B"]);

    const removed = await request(app).delete(`/api/v1/teach/audiobooks/${book.id}/tracks/${ids[2]}`).set(owner);
    expect(removed.body.data.tracks.map((track: { title: string; position: number }) => [track.title, track.position])).toEqual([["A, revised", 1], ["B", 2]]);
    expect(store.has(`audiobooks/${book.id}/${ids[2]}.mp3`)).toBe(false);
  });

  it("drops a published book back to draft when its last chapter is removed", async () => {
    const book = await createBook(owner, `Shrinks ${tag}`);
    await upload(owner, book.id, "Only", mp3());
    await request(app).post(`/api/v1/teach/audiobooks/${book.id}/publish`).set(owner);
    const only = (await prisma.audiobookTrack.findFirstOrThrow({ where: { audiobookId: book.id } })).id;
    const removed = await request(app).delete(`/api/v1/teach/audiobooks/${book.id}/tracks/${only}`).set(owner);
    expect(removed.body.data.status).toBe("DRAFT");
    expect((await request(app).get(`/api/v1/audiobooks/${book.slug}`)).status).toBe(404);
  });
});
