import { api } from "./client";
import type { ChatRequest, ChatResponse } from "./types";

/**
 * Ask-AI, backed by the same endpoint web's chat widget uses.
 *
 * `conversationId` comes back on the first reply and is passed on every subsequent turn, which is
 * what gives the assistant memory of the thread. Mobile keeps a single live conversation in screen
 * state rather than offering the drawer of past conversations web has: scrolling a history of
 * threads is a laptop affordance, and `GET /chat/conversations` has no response shape in the
 * published contract to render one from anyway.
 *
 * The reply can carry a `result` — the backend acting on the request (recording an expense, for
 * instance) rather than only answering. Render what comes back; never re-interpret it.
 */
export const sendChat = (body: ChatRequest) =>
  api
    .post<ChatResponse>("/ai/chat", body, {
      // The shared 20s default is sized for CRUD. A chat turn is a model call plus, often, a tool
      // execution against the database — 20s is routinely not enough, and axios reports the abort
      // with no response, which `errorMessage` then renders as "Cannot reach the server. Check your
      // connection." The server was fine; the client gave up. Same reasoning as `/ai/vision`.
      timeout: 90_000,
    })
    .then((r) => r.data);
