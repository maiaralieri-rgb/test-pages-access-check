import type { Request } from "express";
import { parse } from "cookie";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { getActiveLocalSession, getLocalAccountById } from "../db";

const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_COST = 16384;
const PASSWORD_BLOCK_SIZE = 8;
const PASSWORD_PARALLELIZATION = 1;

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function validateRegistrationCode(input: string) {
  const expected = process.env.ASSINAFLUXO_REGISTRATION_CODE ?? "";
  if (!expected || !input) return false;
  return timingSafeEqual(digest(input), digest(expected));
}

export function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: PASSWORD_COST,
    r: PASSWORD_BLOCK_SIZE,
    p: PASSWORD_PARALLELIZATION,
  }).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: PASSWORD_COST,
    r: PASSWORD_BLOCK_SIZE,
    p: PASSWORD_PARALLELIZATION,
  });
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isStrongPassword(password: string) {
  return password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}

export const LOCAL_SESSION_COOKIE = "assinafluxo_session";
export const LOCAL_SESSION_DAYS = 7;

export function getSessionToken(req: Request) {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();
  const rawCookie = req.headers.cookie;
  return rawCookie ? parse(rawCookie)[LOCAL_SESSION_COOKIE] : undefined;
}

export async function getLocalAccountForRequest(req: Request) {
  const token = getSessionToken(req);
  if (!token) return undefined;
  const session = await getActiveLocalSession(hashOpaqueToken(token));
  if (!session) return undefined;
  return getLocalAccountById(session.accountId);
}
