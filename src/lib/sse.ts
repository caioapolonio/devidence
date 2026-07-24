/**
 * Consumes a Server-Sent Events stream from a POST request.
 *
 * The generate route streams progress over a POST, which `EventSource` can't do
 * (it's GET-only), so we read the body with fetch and parse the `event:` /
 * `data:` frames by hand. Each yielded value is one event.
 */
export type SseEvent = { event: string; data: unknown };

export async function* streamSSE(
  url: string,
  init: RequestInit,
): AsyncGenerator<SseEvent> {
  const response = await fetch(url, init);

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    yield {
      event: "error",
      data: { message: payload?.error ?? "The request failed." },
    };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    // The last piece may be incomplete; keep it for the next read.
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const lines = frame.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;

      const event = eventLine ? eventLine.slice(6).trim() : "message";
      try {
        yield { event, data: JSON.parse(dataLine.slice(5).trim()) };
      } catch {
        // Ignore a frame we can't parse rather than breaking the stream.
      }
    }
  }
}
