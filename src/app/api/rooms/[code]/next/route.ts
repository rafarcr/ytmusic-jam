import { connection, type NextRequest } from "next/server";
import { advance, getRoom, hostAuthorized } from "@/lib/rooms";

export async function POST(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: "Essa jam não existe ou já encerrou." }, { status: 404 });
  const token = bearer(request);
  if (!hostAuthorized(room, token)) {
    return Response.json({ error: "Só o navegador que abriu a jam controla a fila." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { videoId?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  const next = advance(room.code, videoId);
  return Response.json(next);
}

function bearer(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
