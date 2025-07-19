import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import moment from "moment";
import * as whatsapp from "wa-multi-session";
import { createMessageController } from "./controllers/message";
import { createSessionController } from "./controllers/session";
import { env } from "./env";
import { globalErrorMiddleware } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/notfound.middleware";
import { addStream, broadcast, emit, removeStream } from "./services/sse.service";

const app = new Hono();

app.use(
  logger((...params) => {
    params.map((e) => console.log(`${moment().toISOString()} | ${e}`));
  })
);
app.use(cors({
  origin: env.CLIENT_BASE_URL,
  credentials: true
}));

app.onError(globalErrorMiddleware);
app.notFound(notFoundMiddleware);

/**
 * session routes
 */
app.route("/session", createSessionController());
/**
 * message routes
 */
app.route("/message", createMessageController());

app.get("/events", (c) => {
  const session = c.req.query("session");

  return streamSSE(c, async (stream) => {
    const streamId = crypto.randomUUID();
    addStream(streamId, stream);
    console.log(`SSE stream opened: ${streamId}`);

    // Send a confirmation message
    await stream.writeSSE({
      event: "open",
      data: "SSE connection established",
    });

    if (session) {
      const sessionData = whatsapp.getSession(session);
      if (sessionData?.authState) {
        emit(streamId, "session:connected", { session });
      }
    }

    stream.onAbort(() => {
      removeStream(streamId);
      console.log(`SSE stream closed: ${streamId}`);
    });

    // Keep-alive loop
    while (true) {
      // Send a comment to keep the connection alive
      await stream.write(": ping\n\n");
      // Wait for 10 seconds
      await stream.sleep(10000);
    }
  });
});

const port = env.PORT;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

whatsapp.onConnected((session) => {
  console.log(`session: '${session}' connected`);
  broadcast("session:connected", { session });
});

whatsapp.loadSessionsFromStorage();
