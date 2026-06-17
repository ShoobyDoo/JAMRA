import { render, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MangaDetailsPage } from "./MangaDetailsPage";
import { MantineProvider } from "@mantine/core";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

queryClient.setQueryData(["extensions", "manga", "weebcentral", "123"], {
  manga: {
    id: "123",
    title: "Test Manga",
    tags: ["Action"],
    coverUrl: "https://example.com/cover.jpg",
  }
});

queryClient.setQueryData(["extensions", "chapters", "weebcentral", "123"], {
  chapters: [
    { id: "c1", title: "Chapter 1" }
  ]
});

queryClient.setQueryData(["library", "list"], {
  items: []
});

test("renders MangaDetailsPage fully without crashing", async () => {
  try {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <MemoryRouter initialEntries={["/manga/weebcentral/123"]}>
            <Routes>
              <Route path="/manga/:extensionId/:mangaId" element={<MangaDetailsPage />} />
            </Routes>
          </MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>
    );
    await waitFor(() => {
      if (container.querySelector(".mantine-Loader-root")) {
        throw new Error("Still loading");
      }
    }, { timeout: 2000 });
    console.log("Render with data successful!");
  } catch (err) {
    console.error("Render failed!", err);
    throw err;
  }
});
