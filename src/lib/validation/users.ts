import { z } from "zod";

export const PASSWORD_MIN = 8;

const password = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(128, "That password is too long.");

const name = z.string().trim().min(1, "Enter a name.").max(80, "Keep the name under 80 characters.");
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));
const role = z.enum(["ADMIN", "EMPLOYEE"]);

export const setupSchema = z.object({ name, email, password });

export const createUserSchema = z.object({ name, email, role, password });

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: name.optional(),
  role: role.optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({ userId: z.string().min(1), password });

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords don't match.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one.",
  });
