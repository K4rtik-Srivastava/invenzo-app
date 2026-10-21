import { createAuthClient } from "better-auth/react";

// Talks to /api/auth on the same site. Used by the login and password pages.
export const authClient = createAuthClient();
