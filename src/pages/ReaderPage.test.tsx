import { render } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReaderPage } from "./ReaderPage";
import { MantineProvider } from "@mantine/core";

const queryClient = new QueryClient();

test("renders ReaderPage without crashing", () => {
  try {
    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <MemoryRouter initialEntries={["/reader/libId/chapters/chapId"]}>
            <Routes>
              <Route path="/reader/:libraryId/chapters/:chapterId" element={<ReaderPage />} />
            </Routes>
          </MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>
    );
    console.log("ReaderPage render successful!");
  } catch (err) {
    console.error("ReaderPage render failed!", err);
    throw err;
  }
});
