"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createJobSchema, type CreateJobInput } from "@/lib/schemas";
import { ApiError } from "@/lib/client/api";
import { useCreateJob, useJobs } from "@/lib/client/hooks";
import { Button } from "@/components/button";
import { Field } from "@/components/field";

const SAMPLES = [
  "https://cdn.example.com/videos/intro.mp4",
  "https://cdn.example.com/videos/corrupt.mp4",
];

export default function JobsPage() {
  const jobs = useJobs();
  const createJob = useCreateJob();
  const pending = createJob.isPending ? createJob.variables : null;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { sourceUrl: "", title: "" },
  });

  const onSubmit = handleSubmit((values) => {
    createJob.mutate(values, {
      onSuccess: () => reset(),
      onError: (err) => {
        const fieldErrors =
          err instanceof ApiError ? err.fieldErrors : undefined;
        if (!fieldErrors) return setError("root", { message: err.message });
        for (const [field, [message]] of Object.entries(fieldErrors)) {
          setError(field as keyof CreateJobInput, { message });
        }
      },
    });
  });

  return (
    <div className="flex h-full flex-col gap-8">
      <section className="shrink-0">
        <h1 className="mb-4 text-xl font-semibold">New encode job</h1>
        <form
          onSubmit={onSubmit}
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-start"
        >
          <Field
            {...register("sourceUrl")}
            label="Source URL"
            placeholder="https://cdn.example.com/videos/intro.mp4"
            error={errors.sourceUrl?.message}
          />
          <Field
            {...register("title")}
            label="Title"
            placeholder="Optional"
            error={errors.title?.message}
          />
          <Button
            type="submit"
            disabled={createJob.isPending}
            className="sm:mt-6.5"
          >
            Create job
          </Button>
          <p className="flex items-center gap-2 text-xs text-neutral-500">
            Samples
            {SAMPLES.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() =>
                  setValue("sourceUrl", url, { shouldValidate: true })
                }
                className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-neutral-700 hover:border-neutral-400"
              >
                {url.split("/").pop()}
              </button>
            ))}
          </p>
          {errors.root && (
            <p className="text-sm text-red-600 sm:col-span-3">
              {errors.root.message}
            </p>
          )}
        </form>
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <h2 className="mb-4 text-xl font-semibold">Jobs</h2>
        {jobs.isLoading && (
          <p className="text-sm text-neutral-500">Loading jobs…</p>
        )}
        {jobs.isError && (
          <div className="text-sm text-red-600">
            Couldn’t load jobs (is GET /api/jobs implemented?).{" "}
            <button onClick={() => jobs.refetch()} className="underline">
              Retry
            </button>
          </div>
        )}
        {jobs.data?.length === 0 && !pending && (
          <p className="text-sm text-neutral-500">No jobs yet.</p>
        )}
        <ul className="min-h-0 divide-y divide-neutral-200 overflow-y-auto rounded-md border border-neutral-200 bg-white empty:hidden">
          {pending && (
            <li className="flex items-center justify-between gap-3 px-4 py-3 opacity-50">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {pending.title || pending.sourceUrl.split("/").pop()}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {pending.sourceUrl}
                </p>
              </div>
              <StatusBadge value="NEW" />
            </li>
          )}
          {jobs.data?.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {job.sourceUrl}
                  </p>
                </div>
                <StatusBadge value={job.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
