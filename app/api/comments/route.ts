import { NextResponse } from "next/server";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EXPECTED_EMBEDDING_SIZE = 1536;
const SIMILARITY_THRESHOLD = 0.75;
const MAX_RESULTS = 3;

type OpenAIEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
  error?: {
    message?: string;
  };
};

type CommentRow = {
  id: number;
  content: string;
  content_embedding: number[] | string | null;
};

function cosineSimilarity(a: number[], b: number[]) {
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

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denom) return 0;
  return dot / denom;
}

function parseEmbedding(value: CommentRow["content_embedding"]): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topicId = Number(body?.topicId);
    const content =
      typeof body?.content === "string" ? body.content.trim() : "";

    if (!Number.isInteger(topicId) || topicId <= 0 || !content) {
      return NextResponse.json(
        { error: "Missing or invalid topicId/content" },
        { status: 400 }
      );
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server" },
        { status: 500 }
      );
    }

    const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: content,
      }),
    });

    const embeddingJson =
      (await embeddingRes.json().catch(() => null)) as OpenAIEmbeddingResponse | null;

    if (!embeddingRes.ok) {
      const apiMessage =
        embeddingJson?.error?.message || "Unknown OpenAI embeddings error";
      return NextResponse.json(
        { error: `Embedding generation failed: ${apiMessage}` },
        { status: 500 }
      );
    }

    const draftEmbedding = embeddingJson?.data?.[0]?.embedding;
    if (!Array.isArray(draftEmbedding)) {
      return NextResponse.json(
        { error: "Embedding generation failed: missing embedding vector" },
        { status: 500 }
      );
    }

    if (draftEmbedding.length !== EXPECTED_EMBEDDING_SIZE) {
      return NextResponse.json(
        {
          error: `Embedding generation failed: expected ${EXPECTED_EMBEDDING_SIZE} dimensions, received ${draftEmbedding.length}`,
        },
        { status: 500 }
      );
    }

    const commentsRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?select=id,content,content_embedding&topic_id=eq.${topicId}&content_embedding=not.is.null`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}`,
        },
        cache: "no-store",
      }
    );

    if (!commentsRes.ok) {
      const text = await commentsRes.text();
      return NextResponse.json(
        { error: `Failed to load existing comments: ${text}` },
        { status: 500 }
      );
    }

    const rows = (await commentsRes.json()) as CommentRow[];

    const matches = rows
      .map((row) => {
        const embedding = parseEmbedding(row.content_embedding);
        if (!embedding || embedding.length !== EXPECTED_EMBEDDING_SIZE) {
          return null;
        }

        const similarity = cosineSimilarity(draftEmbedding, embedding);
        return {
          id: row.id,
          content: row.content,
          similarity,
        };
      })
      .filter(
        (
          value
        ): value is { id: number; content: string; similarity: number } =>
          Boolean(value) && value!.similarity >= SIMILARITY_THRESHOLD
      )
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_RESULTS);

    return NextResponse.json({ matches });
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