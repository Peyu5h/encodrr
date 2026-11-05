"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { EncodeRun, Job } from "@/lib/types";
import type { CreateJobInput } from "@/lib/schemas";

export const jobKeys = {
  all: ["jobs"] as const,
  detail: (id: string) => ["jobs", id] as const,
};

// Two worked examples to show the intended React Query pattern:
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.all,
    queryFn: ({ signal }) => api.get<Job[]>("/api/jobs", signal),
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === "RUNNING") ? 2_000 : false,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: ({ signal }) => api.get<Job>(`/api/jobs/${id}`, signal),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) => api.post<Job>("/api/jobs", input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  });
}

export function useStartRun(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ runId: string }>("/api/runs", { jobId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  });
}

export function useRun(runId: string, { enabled }: { enabled: boolean }) {
  return useQuery({ queryKey: ["runs", runId], queryFn: () => fetchRun(runId), enabled });
}
/** Imperative one-shot fetch of a run's current state. */
export function fetchRun(runId: string) {
  return api.get<EncodeRun>(`/api/runs/${runId}`);
}
