// filepath: src/services/sse.service.ts
import { SSEStreamingApi } from "hono/streaming";

const streams = new Map<string, SSEStreamingApi>();

export function addStream(id: string, stream: SSEStreamingApi) {
    streams.set(id, stream);
}

export function removeStream(id: string) {
    streams.delete(id);
}

export function broadcast(event: string, data: any) {
    for (const stream of streams.values()) {
        stream.writeSSE({ event, data: JSON.stringify(data), id: crypto.randomUUID() });
    }
}