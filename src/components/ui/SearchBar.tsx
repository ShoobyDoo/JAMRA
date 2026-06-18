import { CloseButton, Input } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import React, { useState } from "react";
import { useNavigate } from "react-router";

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const navigate = useNavigate();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.currentTarget.value);
  };

  const handleClearSearch = () => {
    setQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(
        `/discover?q=${encodeURIComponent(query)}&searchAll=1`,
      );
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        placeholder="Search manga..."
        radius="md"
        value={query}
        w={300}
        onChange={handleSearch}
        leftSection={<IconSearch size={16} />}
        rightSection={
          <CloseButton
            variant="transparent"
            aria-label="Clear input"
            onClick={handleClearSearch}
            style={{ display: query ? undefined : "none" }}
          />
        }
        rightSectionPointerEvents="all"
      />
    </form>
  );
};
