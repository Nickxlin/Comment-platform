import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { commentId, voteType } = await request.json();

    if (!commentId || !voteType) {
      return NextResponse.json(
        { error: "Missing commentId or voteType" },
        { status: 400 }
      );
    }

    const column =
      voteType === "up" ? "upvotes_count" : "downvotes_count";

    const getRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}&select=id,upvotes_count,downvotes_count`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}`,
        },
        cache: "no-store",
      }
    );

    if (!getRes.ok) {
      const text = await getRes.text();
      return NextResponse.json(
        { error: `Read failed: ${text}` },
        { status: 500 }
      );
    }

    const rows = await getRes.json();
    const before = rows?.[0];

    if (!before) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    const currentValue = before[column] ?? 0;
    const newValue = currentValue + 1;

    const updateRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          [column]: newValue,
        }),
      }
    );

    if (!updateRes.ok) {
      const text = await updateRes.text();
      return NextResponse.json(
        { error: `Update failed: ${text}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
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