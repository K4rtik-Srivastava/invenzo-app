// The permission matrix, in one place. The server checks these on every
// action; the UI uses the same rules to decide which buttons to show.

export type Role = "ADMIN" | "EMPLOYEE";

const BOTH: readonly Role[] = ["ADMIN", "EMPLOYEE"];
const ADMIN: readonly Role[] = ["ADMIN"];
const EMPLOYEE: readonly Role[] = ["EMPLOYEE"];

export const PERMISSIONS = {
  "product.view": BOTH,
  "product.viewCost": ADMIN, // purchase price
  "product.manage": ADMIN, // add, edit, archive, delete, adjust stock, units
  "product.import": ADMIN,
  "inventory.export": BOTH,
  "sale.view": BOTH,
  "sale.create": ADMIN, // record a sale; stock is deducted at once
  "sale.manage": ADMIN, // edit or cancel a recorded sale
  "sale.export": ADMIN,
  "request.create": EMPLOYEE, // record a sale for approval, ask to correct or cancel one
  "request.review": ADMIN,
  "user.manage": ADMIN,
  "audit.view": ADMIN,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", EMPLOYEE: "Employee" };
