import { api } from "./client";
import type { ParsedExpenseResult } from "./types";

/**
 * Photograph a receipt and let the backend read it.
 *
 * This is the one capability that is genuinely better on a phone than on a laptop — the camera is
 * already in your hand at the till — and it returns `ParsedExpenseResult`, the *same* shape
 * `POST /expenses/parse` returns for typed text. So the confirm-and-save screen quick-add already
 * has needs no second version: one review UI, one Save, whichever way the expense was captured.
 */
export const scanReceipt = (uri: string, mimeType?: string) => {
  const form = new FormData();
  // React Native's FormData takes this {uri, name, type} shape rather than a Blob; the fetch
  // layer streams the file off disk. Casting is unavoidable — the DOM lib types `append` for
  // browsers, where this object is not a valid value.
  form.append("file", {
    uri,
    name: "receipt.jpg",
    type: mimeType ?? "image/jpeg",
  } as unknown as Blob);

  return api
    .post<ParsedExpenseResult>("/ai/vision", form, {
      headers: { "Content-Type": "multipart/form-data" },
      // The shared 20s default is sized for JSON. This uploads a photo over mobile data and then
      // waits on a vision model; 20s fails requests that were going to succeed.
      timeout: 90_000,
    })
    .then((r) => r.data);
};
