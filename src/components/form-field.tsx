import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Label + control + hint/error, with the error read out by screen readers.
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string[] | string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[0.95rem]">
        {label}
      </Label>
      {children}
      {message ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
