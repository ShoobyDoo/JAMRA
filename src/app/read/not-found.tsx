import Link from "next/link";
import { BookX } from "lucide-react";

export default function ReaderNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <BookX className="h-24 w-24 text-gray-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">404</h1>
          <h2 className="text-2xl font-semibold text-white">Chapter Not Found</h2>
          <p className="text-gray-400">
            The chapter you&apos;re trying to read doesn&apos;t exist or is unavailable.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-gray-200"
          >
            Go Home
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center rounded-md border border-gray-600 bg-transparent px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-900"
          >
            Discover Manga
          </Link>
        </div>
      </div>
    </div>
  );
}
