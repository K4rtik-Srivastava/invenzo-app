"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Shows a toast after a redirect (e.g. "?saved=1"), then removes the flag
// from the address bar so a page refresh doesn't show it again.
export function FlashToast({ message }: { message: string }) {
  const shown = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.success(message);
    const params = new URLSearchParams(searchParams.toString());
    for (const flag of ["created", "saved", "deleted"]) params.delete(flag);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [message, pathname, router, searchParams]);

  return null;
}
