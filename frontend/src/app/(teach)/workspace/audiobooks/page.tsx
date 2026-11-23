import Link from "next/link";
import { serverApiFetch } from "@/lib/api-server";
import { formatBookLength } from "@/lib/audiobooks";
import { Badge } from "@/components/ui/badge";
import { NewAudiobookForm } from "@/components/teach/audiobooks/new-audiobook-form";
import type { TeachAudiobookListResponse } from "@/shared/api/audiobooks";

export const metadata = { title: "Audiobooks | Teach Workspace" };

export default async function TeachAudiobooksPage() {
  const { audiobooks } = await serverApiFetch<TeachAudiobookListResponse>("/api/v1/teach/audiobooks");

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Audiobooks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload MP3 chapters and publish a book to the Audiobooks shelf. Learners see a book only while it is published.
        </p>
      </div>

      <NewAudiobookForm />

      {audiobooks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">You have no audiobooks yet. Create one above.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="teach-audiobooks">
          {audiobooks.map((book) => (
            <li key={book.id}>
              <Link href={`/workspace/audiobooks/${book.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{book.title}</span>
                  <span className="block text-sm tabular-nums text-muted-foreground">
                    {book.tracks.length} {book.tracks.length === 1 ? "chapter" : "chapters"}
                    {book.tracks.length > 0 ? `, ${formatBookLength(book.totalSeconds / 60)}` : ""}
                  </span>
                </span>
                <Badge variant={book.status === "PUBLISHED" ? "default" : "secondary"}>{book.status === "PUBLISHED" ? "Published" : "Draft"}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
