import type {
  CapabilityMatrix,
  ProviderStatusEntry,
  ProviderCapability,
  ProviderId
} from "@mineradio/shared";
import { neteaseAdapter } from "./netease/netease-adapter";
import { qqAdapter } from "./qq/qq-adapter";
import { kugouAdapter } from "./kugou/kugou-adapter";
import type { ProviderAdapter } from "./provider-adapter";

export const providers: Record<ProviderId, ProviderAdapter> = {
  netease: neteaseAdapter,
  qq: qqAdapter,
  kugou: kugouAdapter
};

export const PROVIDER_IDS: ProviderId[] = ["netease", "qq", "kugou"];

const NETEASE_CAPABILITIES: ProviderCapability[] = [
  "search",
  "songUrl",
  "lyric",
  "playlistList",
  "playlistDetail",
  "loginStatus",
  "logout",
  "like"
];

const QQ_CAPABILITIES: ProviderCapability[] = [
  "search",
  "songUrl",
  "lyric",
  "playlistList",
  "playlistDetail",
  "loginStatus",
  "logout"
];

const KUGOU_CAPABILITIES: ProviderCapability[] = [
  "search",
  "songUrl",
  "lyric",
  "playlistList",
  "playlistDetail",
  "loginStatus",
  "logout"
];

export function buildCapabilityMatrix(): CapabilityMatrix {
  const entries: ProviderStatusEntry[] = [
    {
      providerId: "netease",
      available: true,
      capabilities: NETEASE_CAPABILITIES,
      message: "online"
    },
    {
      providerId: "qq",
      available: true,
      capabilities: QQ_CAPABILITIES,
      message: "online"
    },
    {
      providerId: "kugou",
      available: true,
      capabilities: KUGOU_CAPABILITIES,
      message: "online"
    }
  ];
  return { version: "0.1.0", providers: entries };
}
