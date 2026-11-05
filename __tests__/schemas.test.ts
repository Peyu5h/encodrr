import { expect, it } from "vitest";
import { sourceUrlSchema } from "@/lib/schemas";

it.each([
  ["https://cdn.example.com/videos/intro.mp4", true],
  ["http://media.example.org/live/stream.m3u8?token=abc", true],
  ["not a url", false],
  ["ftp://cdn.example.com/intro.mp4", false],
  ["https://cdn.example.com", false],
  ["https://cdn.example.com/notes.txt", false],
])("source url %s is valid: %s", (url, valid) => {
  expect(sourceUrlSchema.safeParse(url).success).toBe(valid);
});
