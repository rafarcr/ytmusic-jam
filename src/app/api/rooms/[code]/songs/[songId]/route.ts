import { connection, type NextRequest } from "next/server";
import { getRoom, hostAuthorized, removeSong } from "@/lib/rooms";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ code: string; songId: string }> },
) {
  await connection();
  const { code, songId } = await context.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: "Essa jam não existe ou já encerrou." }, { status: 404 });
  const token = bearer(request);
  if (!hostAuthorized(room, token)) {
    return Response.json({ error: "Só o navegador que abriu a jam pode tirar música." }, { status: 401 });
  }
  const next = removeSong(room.code, songId);
  return Response.json(next);
}

function bearer(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
