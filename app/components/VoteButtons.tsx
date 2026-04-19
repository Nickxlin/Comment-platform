"use client";

type VoteButtonsProps = {
  commentId: number;
  upvotes: number;
  downvotes: number;
};

export default function VoteButtons({
  commentId,
  upvotes,
  downvotes,
}: VoteButtonsProps) {
  async function handleVote(voteType: "up" | "down") {
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commentId,
        voteType,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.error || "Vote failed");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="flex items-center gap-3 mt-3">
      <button
        type="button"
        onClick={() => handleVote("up")}
        className="rounded-full border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium hover:bg-green-100"
      >
        👍 {upvotes}
      </button>

      <button
        type="button"
        onClick={() => handleVote("down")}
        className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium hover:bg-red-100"
      >
        👎 {downvotes}
      </button>
    </div>
  );
}