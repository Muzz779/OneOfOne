/**
 * Supabase Storage adapter (CLAUDE.md §27, §37).
 *
 * Real private-bucket storage with native signed URLs. `signedUrl` returns an
 * absolute Supabase URL, so the local `/api/files` route (and its HMAC
 * signature) is not used in this mode — `verifySignature` therefore returns
 * false. Uses the service-role client; the app authorizes access before calling.
 */

import "server-only";
import path from "node:path";
import type { StorageBucket } from "@/domain/entities";
import type { StorageService, StoredObjectInfo } from "./types";
import { supabaseAdmin } from "@/server/supabase/clients";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".tiff": "image/tiff",
  ".pdf": "application/pdf",
};

export class SupabaseStorage implements StorageService {
  contentTypeFor(key: string): string {
    return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
  }

  async put(
    bucket: StorageBucket,
    key: string,
    data: Buffer,
    contentType?: string,
  ): Promise<StoredObjectInfo> {
    const { error } = await supabaseAdmin()
      .storage.from(bucket)
      .upload(key, data, {
        contentType: contentType ?? this.contentTypeFor(key),
        upsert: true,
      });
    if (error) throw new Error(`Storage put failed: ${error.message}`);
    return { bytes: data.byteLength };
  }

  async get(bucket: StorageBucket, key: string): Promise<Buffer> {
    const { data, error } = await supabaseAdmin().storage.from(bucket).download(key);
    if (error || !data) throw new Error(`Storage get failed: ${error?.message ?? "not found"}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async exists(bucket: StorageBucket, key: string): Promise<boolean> {
    const idx = key.lastIndexOf("/");
    const dir = idx >= 0 ? key.slice(0, idx) : "";
    const name = idx >= 0 ? key.slice(idx + 1) : key;
    const { data } = await supabaseAdmin().storage.from(bucket).list(dir, { search: name });
    return Boolean(data?.some((f) => f.name === name));
  }

  async remove(bucket: StorageBucket, key: string): Promise<void> {
    await supabaseAdmin().storage.from(bucket).remove([key]);
  }

  async signedUrl(bucket: StorageBucket, key: string, ttlSeconds = 900): Promise<string> {
    const { data, error } = await supabaseAdmin()
      .storage.from(bucket)
      .createSignedUrl(key, ttlSeconds);
    if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? "unknown"}`);
    return data.signedUrl;
  }

  // Not used in Supabase mode — signed URLs point straight at Supabase.
  verifySignature(): boolean {
    return false;
  }

  supportsDirectUpload(): boolean {
    return true;
  }

  async createSignedUploadUrl(
    bucket: StorageBucket,
    key: string,
  ): Promise<{ uploadUrl: string }> {
    const { data, error } = await supabaseAdmin()
      .storage.from(bucket)
      .createSignedUploadUrl(key, { upsert: true });
    if (error || !data) {
      throw new Error(`Signed upload URL failed: ${error?.message ?? "unknown"}`);
    }
    return { uploadUrl: data.signedUrl };
  }
}
