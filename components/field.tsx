import { useId, type ComponentProps } from "react";

type FieldProps = ComponentProps<"input"> & { label: string; error?: string };

export function Field({ label, error, className, ...input }: FieldProps) {
  const errorId = useId();
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-neutral-700">
          {label}
        </span>
        <input
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10 aria-invalid:border-red-500"
          {...input}
        />
      </label>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
