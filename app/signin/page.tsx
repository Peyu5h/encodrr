"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { useAuth } from "@/lib/client/auth-context";
import { Button } from "@/components/button";
import { Field } from "@/components/field";

// Provided as-is. It calls useAuth().login() — which you implement in lib/client/auth-context.tsx.
export default function SignInPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "demo@encodr.dev", password: "" },
  });

  useEffect(() => {
    if (ready && user) router.replace("/jobs");
  }, [ready, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.replace("/jobs");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Login failed");
    }
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Encodr</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Sign in to manage your encode jobs.
      </p>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6"
        noValidate
      >
        <Field
          {...register("email")}
          label="Email"
          type="email"
          autoComplete="username"
          error={errors.email?.message}
        />
        <Field
          {...register("password")}
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
        />

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-neutral-400">
        Demo login: demo@encodr.dev / password123
      </p>
    </div>
  );
}
