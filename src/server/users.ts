import { randomUUID } from "node:crypto";
import { Prisma, type Role } from "@/generated/prisma/client";
import { ROLE_LABEL } from "@/lib/permissions";
import { DEFAULT_UNITS } from "@/lib/default-units";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { hashPassword, verifyPassword } from "@/server/password";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; name: string };

// Any change that could affect "how many active Admins exist" takes this
// lock first, so two Admins acting at the same moment can't both remove
// the last remaining Admin.
const ADMIN_LOCK = 7_301_001;
const SETUP_LOCK = 7_301_002;

function lock(tx: Tx, key: number) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const emailTaken = () => new AppError("A user with this email already exists.", { email: ["This email is already in use."] });

async function insertUser(
  tx: Tx,
  data: { name: string; email: string; role: Role; password: string; mustChangePassword: boolean },
) {
  const id = randomUUID();
  return tx.user.create({
    data: {
      id,
      name: data.name,
      email: data.email,
      role: data.role,
      emailVerified: true,
      mustChangePassword: data.mustChangePassword,
      accounts: {
        create: { id: randomUUID(), providerId: "credential", accountId: id, password: await hashPassword(data.password) },
      },
    },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** True until the very first account exists. */
export async function needsSetup() {
  return (await db.user.count()) === 0;
}

/** First-run setup: creates the first Admin. Refuses once any user exists. */
export async function createFirstAdmin(input: { name: string; email: string; password: string }) {
  try {
    return await db.$transaction(async (tx) => {
      await lock(tx, SETUP_LOCK);
      if ((await tx.user.count()) > 0) throw new AppError("Setup has already been completed. Please sign in.");
      const user = await insertUser(tx, { ...input, role: "ADMIN", mustChangePassword: false });
      // A fresh installation also needs the standard units of measurement.
      await tx.unit.createMany({ data: DEFAULT_UNITS.map((name) => ({ name })), skipDuplicates: true });
      await audit(tx, {
        actorId: user.id,
        action: "user.setup",
        entityType: "user",
        entityId: user.id,
        summary: `${user.name} completed first-run setup as Admin`,
      });
      return user;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw emailTaken();
    throw error;
  }
}

export async function createUser(
  actor: Actor,
  input: { name: string; email: string; role: Role; password: string },
) {
  try {
    return await db.$transaction(async (tx) => {
      const user = await insertUser(tx, { ...input, mustChangePassword: true });
      await audit(tx, {
        actorId: actor.id,
        action: "user.create",
        entityType: "user",
        entityId: user.id,
        summary: `${actor.name} created ${ROLE_LABEL[user.role]} account for ${user.name} (${user.email})`,
        after: user,
      });
      return user;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw emailTaken();
    throw error;
  }
}

export async function updateUser(
  actor: Actor,
  input: { userId: string; name?: string; role?: Role; isActive?: boolean },
) {
  return db.$transaction(async (tx) => {
    await lock(tx, ADMIN_LOCK);
    const before = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!before) throw new AppError("That user no longer exists.");

    const role = input.role ?? before.role;
    const isActive = input.isActive ?? before.isActive;

    if (before.id === actor.id && !isActive) {
      throw new AppError("You can't deactivate your own account.");
    }

    const losesAdmin = before.role === "ADMIN" && before.isActive && (role !== "ADMIN" || !isActive);
    if (losesAdmin) {
      const otherAdmins = await tx.user.count({
        where: { role: "ADMIN", isActive: true, id: { not: before.id } },
      });
      if (otherAdmins === 0) {
        throw new AppError("This is the last active Admin. Make someone else an Admin first.");
      }
    }

    const after = await tx.user.update({
      where: { id: before.id },
      data: { name: input.name ?? before.name, role, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    // Sign a deactivated user out everywhere, immediately.
    if (before.isActive && !isActive) await tx.session.deleteMany({ where: { userId: before.id } });

    const changes: string[] = [];
    if (after.name !== before.name) changes.push(`renamed to "${after.name}"`);
    if (after.role !== before.role) changes.push(`role ${ROLE_LABEL[before.role]} → ${ROLE_LABEL[after.role]}`);
    if (after.isActive !== before.isActive) changes.push(after.isActive ? "reactivated" : "deactivated");
    if (changes.length > 0) {
      await audit(tx, {
        actorId: actor.id,
        action: after.isActive !== before.isActive ? "user.status" : after.role !== before.role ? "user.role" : "user.update",
        entityType: "user",
        entityId: after.id,
        summary: `${actor.name} updated ${before.name}: ${changes.join(", ")}`,
        before,
        after,
      });
    }
    return after;
  });
}

/** Admin sets a new temporary password; the user must change it at next sign-in. */
export async function resetUserPassword(actor: Actor, input: { userId: string; password: string }) {
  const hash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true } });
    if (!user) throw new AppError("That user no longer exists.");
    const updated = await tx.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { password: hash },
    });
    if (updated.count === 0) {
      await tx.account.create({
        data: { id: randomUUID(), userId: user.id, providerId: "credential", accountId: user.id, password: hash },
      });
    }
    await tx.user.update({ where: { id: user.id }, data: { mustChangePassword: user.id !== actor.id } });
    // Sign them out everywhere so the old password stops working at once.
    await tx.session.deleteMany({ where: { userId: user.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "user.password_reset",
      entityType: "user",
      entityId: user.id,
      summary: `${actor.name} reset the password for ${user.name}`,
    });
  });
}

/** A signed-in user changes their own password. Other devices are signed out. */
export async function changeOwnPassword(
  user: { id: string; name: string; sessionToken: string },
  input: { currentPassword: string; newPassword: string },
) {
  const account = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true, password: true },
  });
  if (!account?.password || !(await verifyPassword({ hash: account.password, password: input.currentPassword }))) {
    throw new AppError("Your current password is not correct.", { currentPassword: ["This password is not correct."] });
  }
  const hash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.account.update({ where: { id: account.id }, data: { password: hash } });
    await tx.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    await tx.session.deleteMany({ where: { userId: user.id, token: { not: user.sessionToken } } });
    await audit(tx, {
      actorId: user.id,
      action: "user.password_change",
      entityType: "user",
      entityId: user.id,
      summary: `${user.name} changed their password`,
    });
  });
}
