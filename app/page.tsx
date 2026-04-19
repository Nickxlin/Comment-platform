import Link from "next/link";

type Topic = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
};

async function getTopics(): Promise<Topic[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/topics?select=id,title,slug,description&is_published=eq.true&order=created_at.desc`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load topics");
  }

  return res.json();
}

export default async function HomePage() {
  const topics = await getTopics();

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-sky-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl bg-white shadow-sm border border-slate-200 p-8 mb-8">
          <div className="inline-block rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700 mb-4">
            AI-Organized Discussions
          </div>

          <h1 className="text-4xl font-extrabold text-slate-900 mb-3">
            Comment Product MVP
          </h1>

          <p className="text-lg text-slate-600">
            Explore topics, post comments, and vote on the best opinions.
          </p>
        </div>

        <div className="space-y-5">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="block rounded-3xl bg-white shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-indigo-200 transition"
            >
              <h2 className="text-2xl font-bold text-slate-900">
                {topic.title}
              </h2>

              <p className="text-slate-600 mt-2">
                {topic.description ?? "No description"}
              </p>

              <div className="mt-4 text-sm font-medium text-indigo-600">
                Open discussion →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}