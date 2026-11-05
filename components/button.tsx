import { clsx } from "clsx";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "primary"
          ? "bg-neutral-900 text-white hover:bg-neutral-700"
          : "border border-neutral-300 bg-white hover:bg-neutral-100",
        className,
      )}
      {...props}
    />
  );
}
