/**
 * Local-disk storage (development mock of Supabase Storage) — CLAUDE.md §37, §53.
 *
 * Stores objects under `.data/storage/<bucket>/<key>` (gitignored). Signed URLs
 * are HMAC-signed with an expiry to emulate private-bucket access. This is a
 * clearly-marked DEV implementation; production swaps in a Supabase adapter.
 */

import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageBucket } from "@/domain/entities";
import type { StorageService, StoredObjectInfo } from "./types";

const DATA_ROOT = path.join(process.cwd(), ".data", "storage");

/**
 * Dev signing secret. In production this MUST come from the environment and be
 * a real secret (§19 — never hard-code payment/production secrets). The literal
 * fallback is a development convenience only and grants no access to real data.
 */
const SIGNING_SECRET =
  process.env.ONEOFONE_SIGNING_SECRET ?? "dev-only-insecure-signing-secret";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".tiff": "image/tiff",
  ".pdf": "application/pdf",
};

function safeSegment(s: string): string {
  // Prevent path traversal from keys (§28 — never trust names).
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function diskPath(bucket: StorageBucket, key: string): string {
  const parts = key.split("/").map(safeSegment);
  return path.join(DATA_ROOT, safeSegment(bucket), ...parts);
}

function sign(bucket: StorageBucket, key: string, exp: number): string {
  return createHmac("sha256", SIGNING_SECRET)
    .update(`${bucket}/${key}/${exp}`)
    .digest("hex")
    .slice(0, 32);
}

export class LocalDiskStorage implements StorageService {
  async put(
    bucket: StorageBucket,
    key: string,
    data: Buffer,
  ): Promise<StoredObjectInfo> {
    const p = diskPath(bucket, key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
    return { bytes: data.byteLength };
  }

  async get(bucket: StorageBucket, key: string): Promise<Buffer> {
    return readFile(diskPath(bucket, key));
  }

  async exists(bucket: StorageBucket, key: string): Promise<boolean> {
    try {
      await stat(diskPath(bucket, key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(bucket: StorageBucket, key: string): Promise<void> {
    await rm(diskPath(bucket, key), { force: true });
  }

  async signedUrl(
    bucket: StorageBucket,
    key: string,
    ttlSeconds = 900,
  ): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = sign(bucket, key, exp);
    const q = new URLSearchParams({ key, exp: String(exp), sig });
    return `/api/files/${bucket}?${q.toString()}`;
  }

  verifySignature(
    bucket: StorageBucket,
    key: string,
    exp: number,
    sig: string,
  ): boolean {
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    const expected = sign(bucket, key, exp);
    // Constant-time-ish compare.
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  }

  contentTypeFor(key: string): string {
    return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
  }

  supportsDirectUpload(): boolean {
    return false;
  }

  async createSignedUploadUrl(): Promise<{ uploadUrl: string }> {
    throw new Error("Local disk storage does not support direct uploads.");
  }
}
