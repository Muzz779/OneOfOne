/**
 * Storage service abstraction (CLAUDE.md §27, §37, §53).
 *
 * The rest of the app talks to this interface, never to a concrete provider.
 * The Phase-1 implementation is a local-disk mock ({@link LocalDiskStorage})
 * that emulates private buckets + signed URLs; the production target is Supabase
 * Storage. Swapping providers means writing one adapter, no call-site changes.
 */

import type { StorageBucket } from "@/domain/entities";

export interface StoredObjectInfo {
  readonly bytes: number;
}

export interface StorageService {
  put(
    bucket: StorageBucket,
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<StoredObjectInfo>;

  get(bucket: StorageBucket, key: string): Promise<Buffer>;

  exists(bucket: StorageBucket, key: string): Promise<boolean>;

  remove(bucket: StorageBucket, key: string): Promise<void>;

  /**
   * A time-limited signed URL for private access (§27). Callers must STILL
   * enforce server-side authorization; the signature only proves the URL was
   * issued by us and has not expired.
   */
  signedUrl(
    bucket: StorageBucket,
    key: string,
    ttlSeconds?: number,
  ): Promise<string>;

  /** Verify a signature+expiry pair for a bucket/key (used by the file route). */
  verifySignature(
    bucket: StorageBucket,
    key: string,
    exp: number,
    sig: string,
  ): boolean;

  contentTypeFor(key: string): string;

  /**
   * Whether the client can upload directly to storage (bypassing the app
   * server). Required in production to avoid the serverless request-body limit
   * on large, high-resolution artwork.
   */
  supportsDirectUpload(): boolean;

  /** A one-time signed URL the browser PUTs the file to (direct upload). */
  createSignedUploadUrl(
    bucket: StorageBucket,
    key: string,
  ): Promise<{ uploadUrl: string }>;
}
