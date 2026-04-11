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
    <main className="min-h-screen bg-white text-black p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Comment Product MVP</h1>
        <p className="text-gray-600 mb-6">
          AI-organized discussion topics
        </p>

        <div className="space-y-4">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="block rounded-xl border p-4 hover:bg-gray-50"
            >
              <h2 className="text-xl font-semibold">{topic.title}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {topic.description ?? "No description"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}