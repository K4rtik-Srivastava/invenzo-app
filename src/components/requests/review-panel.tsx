"use client";

import { useState } from "react";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { useAction } from "@/hooks/use-action";
import { approveRequestAction, rejectRequestAction } from "@/server/actions/requests";

export function ReviewPanel({ requestId, requestedBy }: { requestId: string; requestedBy: string }) {
  const [note, setNote] = useState("");
  const approve = useAction(approveRequestAction);
  const reject = useAction(rejectRequestAction);
  const busy = approve.pending || reject.pending;
  return (
    <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
      <h2 className="text-lg font-semibold">Your decision</h2>
      <p className="mt-1 text-muted-foreground">Approving applies the change immediately. Rejecting changes nothing.</p>
      <FormField
        label={`Note to ${requestedBy}`}
        htmlFor="review-note"
        error={reject.fieldErrors.note}
        hint="Optional when approving, needed when rejecting."
        className="mt-4"
      >
        <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="bg-background" />
      </FormField>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button size="lg" disabled={busy} onClick={() => approve.run({ requestId, note })}>
          {approve.pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
          Approve and apply
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={() => reject.run({ requestId, note })}>
          {reject.pending ? <Loader2Icon className="animate-spin" /> : <XIcon />}
          Reject
        </Button>
      </div>
    </section>
  );
}
