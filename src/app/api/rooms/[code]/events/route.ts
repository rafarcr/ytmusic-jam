import { connection, type NextRequest } from "next/server";
import { getRoom, subscribe, toPublic } from "@/lib/rooms";

export async function GET(_request: NextRequest, context: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: "Essa jam não existe ou já encerrou." }, { status: 404 });

  const encoder = new TextEncoder();
  let close = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("room", toPublic(room));
      const unsubscribe = subscribe(room.code, (next) => {
        if (!next) {
          send("ended", { ok: true });
          return;
        }
        send("room", next);
      });
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      close = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
