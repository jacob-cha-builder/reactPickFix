import type { ComponentContext } from "@pickfix/shared";
import type { ViteDevServer } from "vite";

import type { SourceMetadataRegistry } from "./metadata-registry.js";

const serverRegistries = new WeakMap<ViteDevServer, SourceMetadataRegistry>();

export function bindSourceMetadataRegistry(server: ViteDevServer, registry: SourceMetadataRegistry): void {
  serverRegistries.set(server, registry);
}

export function resolveRegisteredContext(server: ViteDevServer, selectionId: string): ComponentContext | undefined {
  return serverRegistries.get(server)?.resolveById(selectionId);
}
