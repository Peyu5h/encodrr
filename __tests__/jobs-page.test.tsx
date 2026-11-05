import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import JobsPage from "@/app/(app)/jobs/page";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows the job while saving, then rolls back and maps server errors to the field", async () => {
  let respondToCreate!: (res: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => (respondToCreate = resolve))
        : Promise.resolve(Response.json([])),
    ),
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      <JobsPage />
    </QueryClientProvider>,
  );

  const user = userEvent.setup();
  const sourceUrl = screen.getByRole("textbox", { name: "Source URL" });
  await user.type(sourceUrl, "https://cdn.example.com/videos/launch.mp4");
  await user.click(screen.getByRole("button", { name: "Create job" }));

  expect(await screen.findByText("launch.mp4")).toBeInTheDocument();

  respondToCreate(
    Response.json(
      {
        detail: "Validation failed",
        fieldErrors: { sourceUrl: ["This host isn't reachable"] },
      },
      { status: 422 },
    ),
  );

  expect(
    await screen.findByText("This host isn't reachable"),
  ).toBeInTheDocument();
  expect(sourceUrl).toHaveAccessibleDescription("This host isn't reachable");
  expect(sourceUrl).toHaveAttribute("aria-invalid", "true");
  expect(screen.queryByText("launch.mp4")).not.toBeInTheDocument();
});
