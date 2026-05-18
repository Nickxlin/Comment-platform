// app/topics/[slug]/page.tsx
import CommentComposer from "@/app/components/commentComposer";
import VoteButtons from "@/app/components/VoteButtons";

type Topic = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
};

type Comment = {
  id: number;
  content: string;
  upvotes_count: number;
  downvotes_count: number;
  created_at: string;
  topic_id: number;
};

async function getTopic(slug: string): Promise<Topic | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/topics?select=id,title,slug,description&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load topic");
  }

  const data = await res.json();
  return data[0] ?? null;
}

async function getComments(topicId: number): Promise<Comment[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?select=id,content,upvotes_count,downvotes_count,created_at,topic_id&topic_id=eq.${topicId}&order=created_at.desc`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load comments");
  }

  return res.json();
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = await getTopic(slug);

  if (!topic) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-2xl font-bold text-red-700">Topic not found</h1>
            <p className="mt-2 text-red-600">The slug was: {slug}</p>
          </div>
        </div>
      </main>
    );
  }

  const comments = await getComments(topic.id);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl bg-white shadow-sm border border-slate-200 p-8 mb-8">
          <div className="inline-block rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700 mb-4">
            Discussion Topic
          </div>

          <h1 className="text-4xl font-extrabold text-slate-900 mb-3">
            {topic.title}
          </h1>

          <p className="text-lg text-slate-600">
            {topic.description ?? "No description"}
          </p>
        </div>

        <CommentComposer topicId={topic.id} topicSlug={topic.slug} />

        <div className="space-y-5">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl bg-white shadow-sm border border-slate-200 p-6"
            >
              <div className="text-slate-800 text-lg leading-8">{c.content}</div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-400">Comment #{c.id}</div>

                <VoteButtons
                  commentId={c.id}
                  upvotes={c.upvotes_count ?? 0}
                  downvotes={c.downvotes_count ?? 0}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}