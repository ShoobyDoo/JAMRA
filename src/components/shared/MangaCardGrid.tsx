import { SimpleGrid, type SimpleGridProps } from "@mantine/core";
import React, { type ReactNode } from "react";

interface MangaCardGridProps {
  children: ReactNode;
  gap?: SimpleGridProps["spacing"];
}

export const MangaCardGrid: React.FC<MangaCardGridProps> = ({
  children,
  gap = "lg",
}) => {
  return (
    <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} spacing={gap}>
      {children}
    </SimpleGrid>
  );
};
