"use client";

import { useSearchParams } from "next/navigation";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      {query ? (
        <p className="text-slate-400">
          Showing results for: <span className="text-indigo-400">{query}</span>
        </p>
      ) : (
        <p className="text-slate-400">Enter a search term above.</p>
      )}
    </div>
  );
}
