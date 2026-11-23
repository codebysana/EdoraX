"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { CourseRatingModal } from "@/components/learn/course-rating-modal";

/**
 * The on-demand path left after the learner dismisses the full prompt.
 * Clicking it opens the rating modal; it never expands on its own.
 */
export function CourseRatingLink({
  courseSlug,
  courseTitle,
}: {
  courseSlug: string;
  courseTitle?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <Star className="size-4" aria-hidden /> Rate this course
      </button>

      <CourseRatingModal
        open={open}
        onClose={() => setOpen(false)}
        courseSlug={courseSlug}
        courseTitle={courseTitle}
        dismissLabel="Cancel"
        onSubmitted={() => router.refresh()}
      />
    </>
  );
}

/**
 * Header button on the lesson page. Once the learner is past halfway it is always there, so a
 * rating placed by accident can be changed without leaving the lesson.
 */
export function ReaderRatingButton({
  courseSlug,
  courseTitle,
  rating,
}: {
  courseSlug: string;
  courseTitle: string;
  rating: { rating: number; review: string | null } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const label = rating ? `Your rating: ${rating.rating} of 5. Change it` : "Rate this course";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-yellow"
      >
        <Star className={rating ? "size-5 fill-current text-brand-yellow" : "size-5"} aria-hidden />
        {rating ? <span className="hidden tabular-nums lg:inline">{rating.rating}/5</span> : null}
      </button>

      <CourseRatingModal
        open={open}
        onClose={() => setOpen(false)}
        courseSlug={courseSlug}
        courseTitle={courseTitle}
        initialRating={rating?.rating ?? 0}
        initialReview={rating?.review ?? ""}
        dismissLabel="Cancel"
        onSubmitted={() => router.refresh()}
      />
    </>
  );
}
