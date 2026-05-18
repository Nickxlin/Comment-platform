"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CommentComposerProps = {
  topicId: number;
  topicSlug: string;
};

type SimilarCommentMatch = {
  id: number;
  content: string;
  similarity: number;
};

export default function CommentComposer({
  topicId,
  topicSlug,
}: CommentComposerProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [similarMatches, setSimilarMatches] = useState<SimilarCommentMatch[]>([]);

  const trimmedContent = useMemo(() => content.trim(), [content]);

  useEffect(() => {
    if (trimmedContent.length < 8) {
      setSimilarMatches([]);
      setSimilarError(null);
      setIsCheckingSimilar(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setIsCheckingSimilar(true);
        setSimilarError(null);

        const response = await fetch("/api/comments/similar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topicId,
            content: trimmedContent,
          }),
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to check similar comments");
        }

        setSimilarMatches(Array.isArray(data?.matches) ? data.matches : []);
      } catch (similarityError) {
        if (
          similarityError instanceof Error &&
          similarityError.name === "AbortError"
        ) {
          return;
        }

        setSimilarMatches([]);
        setSimilarError(
          similarityError instanceof Error
            ? similarityError.message
            : "Failed to check similar comments"
        );
      } finally {
        setIsCheckingSimilar(false);
      }
    }, 450);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [topicId, trimmedContent]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedContent || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicId,
          topicSlug,
          content: trimmedContent,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to submit comment");
      }

      setContent("");
      setSimilarMatches([]);
      setSimilarError(null);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unexpected error while submitting comment"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-white shadow-sm border border-slate-200 p-6 mb-8"
      data-topic-slug={topicSlug}
    >
      <label className="block text-lg font-semibold text-slate-800 mb-3">
        Add your comment
      </label>

      <textarea
        name="content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Share your opinion..."
        className="w-full rounded-2xl border border-slate-300 p-4 mb-4 min-h-[130px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        required
        disabled={isSubmitting}
      />

      {similarMatches.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            Similar comments may already exist
          </p>
          <ul className="mt-2 space-y-2">
            {similarMatches.slice(0, 3).map((match) => (
              <li key={match.id} className="text-sm text-amber-900">
                <span className="font-medium">
                  {Math.round(match.similarity * 100)}%
                </span>{" "}
                — {match.content}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isCheckingSimilar ? (
        <p className="mb-4 text-sm text-slate-500">Checking for similar comments…</p>
      ) : null}

      {similarError ? (
        <p className="mb-4 text-sm text-amber-700">{similarError}</p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Submitting..." : "Submit Comment"}
      </button>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}