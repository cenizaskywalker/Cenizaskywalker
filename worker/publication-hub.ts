import { DurableObject } from "cloudflare:workers";
import type { AppEnv } from "./types";

export class PublicationHub extends DurableObject<AppEnv> {
  fetch(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  broadcast(version: string): void {
    const message = JSON.stringify({ type: "content-published", version });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(message); } catch { socket.close(1011, "Delivery failed"); }
    }
  }
}
