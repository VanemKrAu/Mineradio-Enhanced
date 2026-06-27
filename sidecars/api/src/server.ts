import {
  HealthResponseSchema,
  ProviderIdSchema,
  type CapabilityMatrix,
  type ProviderId,
  type Track
} from "@mineradio/shared";
import { appVersion, apiVersion, schemaVersion, port } from "./env";
import { ok, fail, json } from "./http/envelope";
import { providers, buildCapabilityMatrix, PROVIDER_IDS } from "./providers/registry";
import { ProviderNotImplementedError } from "./providers/provider-adapter";
import { normalizeError } from "./services/fallback";
import { buildDiagnostics } from "./services/diagnostics";
import { resolveAudioProxy } from "./services/audio-proxy";

export async function routeHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  if (path === "/health" && method === "GET") {
    const body = HealthResponseSchema.parse({
      ok: true,
      appVersion: appVersion(),
      apiVersion: apiVersion(),
      schemaVersion: schemaVersion(),
      providers: PROVIDER_IDS
    });
    return json(body);
  }

  if (path === "/providers/capabilities" && method === "GET") {
    const matrix: CapabilityMatrix = buildCapabilityMatrix();
    return json(ok(matrix));
  }

  if (path === "/diagnostics" && method === "GET") {
    return json(buildDiagnostics());
  }

  if (path === "/audio-proxy" && method === "GET") {
    const target = url.searchParams.get("url") ?? "";
    return json(resolveAudioProxy(target), 501);
  }

  const match = path.match(/^\/providers\/([^/]+)\/(.+)$/);
  if (match) {
    const providerRaw = decodeURIComponent(match[1]);
    const sub = decodeURIComponent(match[2]);
    const parsed = ProviderIdSchema.safeParse(providerRaw);
    if (!parsed.success) {
      return json(
        fail({
          code: "NOT_FOUND",
          message: `unknown provider: ${providerRaw}`,
          retryable: false
        }),
        404
      );
    }
    const providerId: ProviderId = parsed.data;
    const adapter = providers[providerId];

    try {
      if (sub === "login-status" && method === "GET") {
        return json(ok(await adapter.loginStatus()));
      }
      if (sub === "logout" && method === "POST") {
        await adapter.logout();
        return json(ok({ provider: providerId, loggedOut: true }));
      }
      if (sub === "search" && method === "GET") {
        const keyword = url.searchParams.get("keyword") ?? "";
        if (!keyword.trim()) {
          return json(
            fail({
              code: "BAD_REQUEST",
              message: "keyword required",
              provider: providerId,
              retryable: false
            }),
            400
          );
        }
        const limitRaw = url.searchParams.get("limit");
        const limitParsed = limitRaw === null ? NaN : Number(limitRaw);
        const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.floor(limitParsed) : 20;
        return json(ok(await adapter.search({ keyword, limit })));
      }
      if (sub === "song-url" && method === "POST") {
        const body = await parseJsonBody(request);
        if (body === null) {
          return json(
            fail({
              code: "BAD_REQUEST",
              message: "invalid or missing JSON body",
              provider: providerId,
              retryable: false
            }),
            400
          );
        }
        return json(ok(await adapter.songUrl(body as Track)));
      }
      if (sub === "lyric" && method === "POST") {
        const body = await parseJsonBody(request);
        if (body === null) {
          return json(
            fail({
              code: "BAD_REQUEST",
              message: "invalid or missing JSON body",
              provider: providerId,
              retryable: false
            }),
            400
          );
        }
        return json(ok(await adapter.lyric(body as Track)));
      }
      if (sub === "playlists" && method === "GET") {
        return json(ok(await adapter.playlistList()));
      }
      const detailMatch = sub.match(/^playlists\/(.+)$/);
      if (detailMatch && method === "GET") {
        const id = decodeURIComponent(detailMatch[1]);
        return json(ok(await adapter.playlistDetail(id)));
      }
      return json(
        fail({
          code: "NOT_FOUND",
          message: `unknown route: ${method} ${path}`,
          retryable: false
        }),
        404
      );
    } catch (err) {
      return json(normalizeError(providerId, err), statusFromError(err));
    }
  }

  return json(
    fail({
      code: "NOT_FOUND",
      message: `unknown route: ${method} ${path}`,
      retryable: false
    }),
    404
  );
}

function statusFromError(err: unknown): number {
  if (err instanceof ProviderNotImplementedError) return 501;
  return 500;
}

async function parseJsonBody(request: Request): Promise<unknown | null> {
  try {
    const text = await request.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

if (import.meta.main) {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: port(),
    fetch: routeHandler
  });
  console.log(`[sidecar] listening on http://${server.hostname}:${server.port}`);
}