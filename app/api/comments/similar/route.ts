import { NextResponse } from "next/server";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EXPECTED_EMBEDDING_SIZE = 1536;
const MAX_RESULTS = 3;
const DEFAULT_MIN_SIMILARITY = 0.7;

type OpenAIEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
  error?: {
    message?: string;
  };
};

type SupabaseCommentRow = {
  id: number;
  content: string;
  content_embedding: unknown;
};

type SimilarComment = {
  id: number;
  content: string;
  similarity: number;
};

function parseEmbedding(value: unknown): number[] | null {
  if (!value) return null;

  // Supabase/PostgREST may return vector values as arrays or strings depending on config.
  if (Array.isArray(value)) {
    return value.every((n) => typeof n === "number") ? (value as number[]) : null;
  }

  if (typeof value === "string") {
    // Handle JSON array form: "[0.1,0.2,...]"
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        return parsed as number[];
      }
    } catch {
      // Continue to attempt pgvector text format parsing below.
    }

    // Handle pgvector text form: "[0.1,0.2,...]"
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const parts = trimmed
        .slice(1, -1)
        .split(",")
        .map((p) => Number(p.trim()));

      if (parts.every((n) => Number.isFinite(n))) {
        return parts;
      }
    }
  }

  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topicId = Number(body?.topicId);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const minSimilarity =
      typeof body?.minSimilarity === "number"
        ? body.minSimilarity
        : DEFAULT_MIN_SIMILARITY;

    if (!Number.isInteger(topicId) || topicId <= 0) {
      return badRequest("Invalid topicId");
    }

    if (!content) {
      return badRequest("Content is required");
    }

    if (minSimilarity < -1 || minSimilarity > 1) {
      return badRequest("minSimilarity must be between -1 and 1");
    }

    if (!process.env.OPENAI_API_KEY) {
      return serverError("OPENAI_API_KEY is not configured on the server");
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return serverError("Supabase environment variables are not configured");
    }

    const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: content,
      }),
    });

    const embeddingJson =
      (await embeddingRes.json().catch(() => null)) as OpenAIEmbeddingResponse | null;

    if (!embeddingRes.ok) {
      const openAiError =
        embeddingJson?.error?.message || "Failed to generate embedding";
      return serverError(`OpenAI embedding error: ${openAiError}`);
    }

    const draftEmbedding = embeddingJson?.data?.[0]?.embedding;

    if (!Array.isArray(draftEmbedding)) {
      return serverError("OpenAI embedding response missing embedding vector");
    }

    if (draftEmbedding.length !== EXPECTED_EMBEDDING_SIZE) {
      return serverError(
        `Embedding dimension mismatch: expected ${EXPECTED_EMBEDDING_SIZE}, received ${draftEmbedding.length}`
      );
    }

    const commentsRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?select=id,content,content_embedding&topic_id=eq.${topicId}&content_embedding=not.is.null`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
        },
        cache: "no-store",
      }
    );

    if (!commentsRes.ok) {
      const text = await commentsRes.text();
      return serverError(`Failed to load comments from Supabase: ${text}`);
    }

    const rows = (await commentsRes.json()) as SupabaseCommentRow[];

    const similar: SimilarComment[] = [];

    for (const row of rows) {
      const existingEmbedding = parseEmbedding(row.content_embedding);

      if (!existingEmbedding) continue;
      if (existingEmbedding.length !== EXPECTED_EMBEDDING_SIZE) continue;

      const similarity = cosineSimilarity(draftEmbedding, existingEmbedding);

      if (similarity >= minSimilarity) {
        similar.push({
          id: row.id,
          content: row.content,
          similarity,
        });
      }
    }

    similar.sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      matches: similar.slice(0, MAX_RESULTS),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}