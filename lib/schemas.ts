import { z } from "zod";

// Schemas are shared between client (React Hook Form resolver) and server (Route Handler validation),
// so the same rules apply in both places and field errors map cleanly back to the form.

const MEDIA_FILE = /\.(mp4|m4v|mov|mkv|webm|avi|ts|m3u8|mpd)$/i;

export const sourceUrlSchema = z
  .string()
  .trim()
  .min(1, "Source URL is required")
  .pipe(
    z
      // abort so the media check never runs on an unparsable url
      .httpUrl({ error: "Enter a valid http(s) URL", abort: true })
      .refine(
        (url) => MEDIA_FILE.test(new URL(url).pathname),
        "Link to a media file, e.g. .mp4, .mov or .m3u8",
      ),
  );

export const createJobSchema = z.object({
  sourceUrl: sourceUrlSchema,
  title: z
    .string()
    .trim()
    .max(80, "Keep the title under 80 characters")
    .optional()
    .or(z.literal("")),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const startRunSchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});
