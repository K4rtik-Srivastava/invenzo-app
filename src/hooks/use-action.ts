"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action";

// Runs a server action, tracks "saving…" state, shows a toast with the result
// and keeps field errors so forms can show them next to each input.
export function useAction<I, T>(
  action: (input: I) => Promise<ActionResult<T>>,
  options: { onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>, input: I) => void; successToast?: boolean } = {},
) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [details, setDetails] = useState<Record<string, string> | undefined>(undefined);

  function run(input: I) {
    startTransition(async () => {
      const result = await action(input);
      if (!result) return; // the action redirected to another page
      if (result.ok) {
        setFieldErrors({});
        setDetails(undefined);
        if (options.successToast !== false && result.message) toast.success(result.message);
        options.onSuccess?.(result, input);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setDetails(result.details);
        toast.error(result.error);
      }
    });
  }

  return { run, pending, fieldErrors, setFieldErrors, details };
}
