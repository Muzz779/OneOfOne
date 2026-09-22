/**
 * Service container (CLAUDE.md §53, §57.5).
 *
 * Single wiring point for the repo + every integration behind its interface.
 * Swapping a mock for a real provider (Supabase, Yoco, an AI upscaler, PUDO,
 * email/SMS) happens HERE — nothing else changes. Instances are cached on
 * globalThis so they survive Next.js dev hot-reload.
 */

import "server-only";
import { getActivePrinterSpec, type PrinterSpec } from "@/config/printer";
import { isSupabaseConfigured, isYocoConfigured } from "./env";
import { InMemoryRepo, type Repo } from "./repo";
import { SupabaseRepo } from "./repo-supabase";
import { LocalDiskStorage } from "./storage/local";
import { SupabaseStorage } from "./storage/supabase";
import type { StorageService } from "./storage/types";
import { SharpImageProcessor, type ImageProcessor } from "./services/image";
import { DevUpscaleEnhancer, type EnhancementService } from "./services/enhancement";
import {
  DevColorKeyRemover,
  type BackgroundRemovalService,
} from "./services/background";
import { MockYocoProvider, YocoProvider, type PaymentProvider } from "./services/payment";
import { MockPudoDelivery, type DeliveryService } from "./services/delivery";
import {
  MockNotificationService,
  type NotificationService,
} from "./services/notifications";
import { MockAuthService } from "./auth/mock";
import { SupabaseAuthService } from "./auth/supabase";
import type { AuthService } from "./auth/types";

interface Container {
  repo: Repo;
  storage: StorageService;
  auth: AuthService;
  image: ImageProcessor;
  enhancer: EnhancementService;
  bgRemover: BackgroundRemovalService;
  payment: PaymentProvider;
  delivery: DeliveryService;
  notifier: NotificationService;
}

const globalForContainer = globalThis as unknown as {
  __oneofone?: Container;
};

function build(): Container {
  const supabase = isSupabaseConfigured();
  const repo: Repo = supabase ? new SupabaseRepo() : new InMemoryRepo();
  const storage: StorageService = supabase ? new SupabaseStorage() : new LocalDiskStorage();
  const auth: AuthService = supabase ? new SupabaseAuthService() : new MockAuthService(repo);
  return {
    repo,
    storage,
    auth,
    image: new SharpImageProcessor(),
    enhancer: new DevUpscaleEnhancer(),
    bgRemover: new DevColorKeyRemover(),
    payment: isYocoConfigured() ? new YocoProvider() : new MockYocoProvider(),
    delivery: new MockPudoDelivery(),
    notifier: new MockNotificationService(),
  };
}

function container(): Container {
  if (!globalForContainer.__oneofone) {
    globalForContainer.__oneofone = build();
  }
  return globalForContainer.__oneofone;
}

export const getRepo = (): Repo => container().repo;
export const getStorage = (): StorageService => container().storage;
export const getAuth = (): AuthService => container().auth;
export const getImageProcessor = (): ImageProcessor => container().image;
export const getEnhancer = (): EnhancementService => container().enhancer;
export const getBgRemover = (): BackgroundRemovalService => container().bgRemover;
export const getPayment = (): PaymentProvider => container().payment;
export const getDelivery = (): DeliveryService => container().delivery;
export const getNotifier = (): NotificationService => container().notifier;
export const getPrinterSpec = (): PrinterSpec => getActivePrinterSpec();
