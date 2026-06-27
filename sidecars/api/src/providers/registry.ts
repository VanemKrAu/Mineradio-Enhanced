import type { CapabilityMatrix, ProviderStatusEntry, ProviderId } from "@mineradio/shared";
import { neteaseAdapter } from "./netease/netease-adapter";
import { qqAdapter } from "./qq/qq-adapter";
import type { ProviderAdapter } from "./provider-adapter";

export const providers: Record<ProviderId, ProviderAdapter> = {
  netease: neteaseAdapter,
  qq: qqAdapter
};

export const PROVIDER_IDS: ProviderId[] = ["netease", "qq"];

export function buildCapabilityMatrix(): CapabilityMatrix {
  const entries: ProviderStatusEntry[] = PROVIDER_IDS.map((id) => ({
    providerId: id,
    available: false,
    capabilities: [],
    message: "provider not implemented"
  }));
  return { version: "0.1.0", providers: entries };
}