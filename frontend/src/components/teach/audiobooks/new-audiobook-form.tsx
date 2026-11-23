"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeachAudiobook } from "@/shared/api/audiobooks";

export function NewAudiobookForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const book = await apiFetch<TeachAudiobook>("/api/v1/teach/audiobooks", { method: "POST", json: { title } });
      router.push(`/workspace/audiobooks/${book.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create the audiobook.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-3" data-testid="new-audiobook-form">
      <div className="min-w-64 flex-1">
        <label htmlFor="new-audiobook-title" className="sr-only">
          Audiobook title
        </label>
        <Input id="new-audiobook-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title of the new audiobook" maxLength={120} required />
        {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
      <Button type="submit" size="lg" disabled={pending || title.trim().length < 2}>
        {pending ? "Creating…" : "Create audiobook"}
      </Button>
    </form>
  );
}
