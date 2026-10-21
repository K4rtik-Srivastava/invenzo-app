import "server-only";

// Sends email through Resend (https://resend.com) when RESEND_API_KEY is set.
// Without it, email features are switched off and admins reset passwords instead.
export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!response.ok) {
    console.error("Email failed", response.status, await response.text());
  }
}
