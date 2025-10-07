"use client";

interface GenrePillsProps {
  genres: string[];
}

export function GenrePills({ genres }: GenrePillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((genre) => (
        <span
          key={genre}
          className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-secondary/80"
        >
          {genre}
        </span>
      ))}
    </div>
  );
}
