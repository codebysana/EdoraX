"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Trash2, Upload } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { chapterTitleFromFileName, uploadAudiobookChapter } from "@/lib/audiobook-upload";
import { formatBookLength } from "@/lib/audiobooks";
import { COURSE_CATEGORY_INFO } from "@/lib/course-categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TeachAudiobook } from "@/shared/api/audiobooks";

const BASE = "/api/v1/teach/audiobooks";

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

export function AudiobookEditor({ initial }: { initial: TeachAudiobook }) {
  const router = useRouter();
  const [book, setBook] = useState(initial);
  const [details, setDetails] = useState({ title: initial.title, authorName: initial.authorName, description: initial.description ?? "", category: initial.category });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const published = book.status === "PUBLISHED";

  /** Runs one change, shows its error, and keeps the book the server sends back. */
  async function run(label: string, action: () => Promise<TeachAudiobook | void>, done?: string) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      if (next) setBook(next);
      if (done) setNotice(done);
    } catch (caught) {
      setError(message(caught, "Something went wrong. Try again."));
    } finally {
      setBusy(null);
    }
  }

  const dirty =
    details.title.trim() !== book.title ||
    details.authorName.trim() !== book.authorName ||
    details.description.trim() !== (book.description ?? "") ||
    details.category !== book.category;

  const saveDetails = () =>
    run(
      "save",
      () =>
        apiFetch<TeachAudiobook>(`${BASE}/${book.id}`, {
          method: "PATCH",
          json: { title: details.title, authorName: details.authorName, description: details.description || null, category: details.category },
        }),
      "Saved.",
    );

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setNotice(null);
    // One file after another, in the order chosen, so chapters keep that order.
    const chosen = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    let latest = book;
    try {
      for (const file of chosen) {
        setUploading(file.name);
        latest = await uploadAudiobookChapter(book.id, file, chapterTitleFromFileName(file.name));
        setBook(latest);
      }
      setNotice(chosen.length === 1 ? "Chapter added." : `${chosen.length} chapters added.`);
    } catch (caught) {
      setError(message(caught, "The upload failed."));
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function move(index: number, by: -1 | 1) {
    const ids = book.tracks.map((track) => track.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    return run("order", () => apiFetch<TeachAudiobook>(`${BASE}/${book.id}/tracks/order`, { method: "PUT", json: { trackIds: ids } }));
  }

  const rename = (trackId: string, title: string) => {
    if (!title.trim() || title.trim() === book.tracks.find((track) => track.id === trackId)?.title) return;
    return run("rename", () => apiFetch<TeachAudiobook>(`${BASE}/${book.id}/tracks/${trackId}`, { method: "PATCH", json: { title } }));
  };

  const removeTrack = (trackId: string, title: string) => {
    if (!window.confirm(`Remove "${title}" and its audio file?`)) return;
    return run("remove", () => apiFetch<TeachAudiobook>(`${BASE}/${book.id}/tracks/${trackId}`, { method: "DELETE" }));
  };

  const setPublished = (next: boolean) =>
    run("publish", () => apiFetch<TeachAudiobook>(`${BASE}/${book.id}/${next ? "publish" : "unpublish"}`, { method: "POST" }), next ? "Published. Learners can listen now." : "Unpublished. Learners can no longer see it.");

  async function deleteBook() {
    if (!window.confirm(`Delete "${book.title}" and all of its audio? This cannot be undone.`)) return;
    setBusy("delete");
    setError(null);
    try {
      await apiFetch<void>(`${BASE}/${book.id}`, { method: "DELETE" });
      router.push("/workspace/audiobooks");
    } catch (caught) {
      setError(message(caught, "Could not delete the audiobook."));
      setBusy(null);
    }
  }

  const working = busy !== null || uploading !== null;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <Link href="/workspace/audiobooks" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft aria-hidden className="size-4" />
          All audiobooks
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight sm:text-3xl">{book.title}</h1>
          <Badge variant={published ? "default" : "secondary"}>{published ? "Published" : "Draft"}</Badge>
        </div>
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
          {book.tracks.length} {book.tracks.length === 1 ? "chapter" : "chapters"}
          {book.tracks.length > 0 ? `, ${formatBookLength(book.totalSeconds / 60)}` : ""}
        </p>
      </div>

      <div aria-live="polite">
        {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
      </div>

      <section aria-labelledby="details-heading" className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 id="details-heading" className="text-lg font-semibold">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Title
            <Input className="mt-1.5" value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} maxLength={120} />
          </label>
          <label className="block text-sm font-medium">
            Author shown to learners
            <Input className="mt-1.5" value={details.authorName} onChange={(event) => setDetails({ ...details, authorName: event.target.value })} maxLength={80} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Shelf
          <select
            className="mt-1.5 h-12 w-full rounded-md border-2 border-input bg-card px-3 text-base"
            value={details.category}
            onChange={(event) => setDetails({ ...details, category: event.target.value as TeachAudiobook["category"] })}
          >
            {COURSE_CATEGORY_INFO.map((info) => (
              <option key={info.value} value={info.value}>{info.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Description
          <Textarea className="mt-1.5" rows={4} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} maxLength={2000} />
        </label>
        <Button onClick={saveDetails} disabled={!dirty || working || details.title.trim().length < 2 || !details.authorName.trim()}>
          {busy === "save" ? "Saving…" : "Save details"}
        </Button>
      </section>

      <section aria-labelledby="chapters-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="chapters-heading" className="text-lg font-semibold">Chapters</h2>
          <div>
            <input ref={fileInput} id="chapter-files" type="file" accept="audio/mpeg,.mp3" multiple className="sr-only" onChange={(event) => void upload(event.target.files)} disabled={working} />
            <Button type="button" variant="outline" disabled={working} onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden className="size-4" />
              {uploading ? `Uploading ${uploading}…` : "Upload MP3 chapters"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">MP3 only, up to 50 MB each. Choose several files at once and they are added in file name order.</p>

        {book.tracks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No chapters yet.</p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="chapter-list">
            {book.tracks.map((track, index) => (
              <li key={track.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="w-6 text-sm tabular-nums text-muted-foreground">{track.position}</span>
                <div className="min-w-56 flex-1">
                  <label className="sr-only" htmlFor={`title-${track.id}`}>Chapter {track.position} title</label>
                  <Input
                    id={`title-${track.id}`}
                    key={`${track.id}-${track.title}`}
                    defaultValue={track.title}
                    maxLength={160}
                    disabled={working}
                    onBlur={(event) => void rename(track.id, event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                  />
                </div>
                <span className="w-16 text-right text-sm tabular-nums text-muted-foreground">{formatBookLength(track.durationSeconds / 60)}</span>
                <audio controls preload="none" src={track.src} className="h-9 w-48 max-w-full" aria-label={`Preview chapter ${track.position}`} />
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={`Move chapter ${track.position} up`} disabled={working || index === 0} onClick={() => void move(index, -1)}>
                    <ArrowUp aria-hidden className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Move chapter ${track.position} down`} disabled={working || index === book.tracks.length - 1} onClick={() => void move(index, 1)}>
                    <ArrowDown aria-hidden className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove chapter ${track.position}`} disabled={working} onClick={() => void removeTrack(track.id, track.title)}>
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="publish-heading" className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 id="publish-heading" className="text-lg font-semibold">{published ? "Published" : "Publish"}</h2>
        <p className="text-sm text-muted-foreground">
          {published
            ? "This book is on the Audiobooks shelf. Unpublish it to take it off the shelf and close its audio."
            : "Publishing puts the book on the Audiobooks shelf for every learner. You need at least one chapter."}
        </p>
        <div className="flex flex-wrap gap-3">
          {published ? (
            <>
              <Button variant="outline" disabled={working} onClick={() => void setPublished(false)}>{busy === "publish" ? "Working…" : "Unpublish"}</Button>
              <Link href={`/audiobooks/${book.slug}`} className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline">View on the shelf</Link>
            </>
          ) : (
            <Button disabled={working || book.tracks.length === 0} onClick={() => void setPublished(true)}>{busy === "publish" ? "Publishing…" : "Publish audiobook"}</Button>
          )}
          <Button variant="destructive" className="ml-auto" disabled={working} onClick={() => void deleteBook()}>
            {busy === "delete" ? "Deleting…" : "Delete audiobook"}
          </Button>
        </div>
      </section>
    </div>
  );
}
