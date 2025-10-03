"use client";

import Link from "next/link";
import {
  Anchor,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

export default function SignInPage() {
  return (
    <Stack gap="xl" p="xl" maw={420} mx="auto">
      <Stack gap="xs">
        <Title order={1}>Sign in</Title>
        <Text size="sm" c="dimmed">
          Enter your email and password to access your library.
        </Text>
      </Stack>

      <Paper component="form" p="lg" radius="lg" withBorder>
        <Stack gap="md">
          <TextInput
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            radius="md"
            required
          />
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            placeholder="••••••••"
            radius="md"
            required
          />
          <Button type="submit" fullWidth>
            Sign in
          </Button>
        </Stack>
      </Paper>

      <Text size="sm" c="dimmed">
        Don&apos;t have an account?{" "}
        <Anchor component={Link} href="#" color="brand" underline="hover">
          Create account
        </Anchor>
      </Text>
    </Stack>
  );
}
