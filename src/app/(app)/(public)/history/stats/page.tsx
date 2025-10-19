"use client";

import { useEffect } from "react";
import { useHistory } from "@/store/history";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Library, TrendingUp, Star } from "lucide-react";
import Link from "next/link";

export default function HistoryStatsPage() {
  const { stats, loadStats, isLoading, error } = useHistory();

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Reading Statistics</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive font-medium">
            Failed to load statistics
          </p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reading Statistics</h1>
        <p className="text-muted-foreground mt-1">
          Track your reading habits and progress
        </p>
      </div>

      {/* Overview Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Entries
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
              <p className="text-xs text-muted-foreground">
                All recorded actions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Chapters Read
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.chaptersRead}</div>
              <p className="text-xs text-muted-foreground">
                Total reading sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Manga Started
              </CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.mangaStarted}</div>
              <p className="text-xs text-muted-foreground">
                Unique titles read
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Library Additions
              </CardTitle>
              <Library className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.libraryAdditions}</div>
              <p className="text-xs text-muted-foreground">
                Manga added to library
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Action Breakdown */}
      {!isLoading && stats && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Breakdown</CardTitle>
            <CardDescription>Distribution of your actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.actionCounts).map(([action, count]) => {
                const total = stats.totalEntries;
                const percentage =
                  total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div key={action} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">
                        {action.replace(/_/g, " ")}
                      </span>
                      <span className="text-muted-foreground">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most Read Manga */}
      {!isLoading && stats && stats.mostReadManga.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Read Manga</CardTitle>
            <CardDescription>
              Your top 10 most frequently read titles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.mostReadManga.map((manga, index) => (
                <div
                  key={manga.mangaId}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-muted-foreground w-8">
                      {index + 1}
                    </span>
                    <Link
                      href={`/manga/${manga.mangaId}`}
                      className="font-medium hover:underline"
                    >
                      {manga.title}
                    </Link>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {manga.count} {manga.count === 1 ? "chapter" : "chapters"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
