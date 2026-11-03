import { connection, type NextRequest } from "next/server";
import { endRoom, getRoom, hostAuthorized, toPublic } from "@/lib/rooms";

type Context = { params: Promise<{ code: string }> };

export async function GET(_request: NextRequest, context: Context) {
  await connection();
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: "Essa jam não existe ou já encerrou." }, { status: 404 });
  return Response.json(toPublic(room));
}

export async function DELETE(request: NextRequest, context: Context) {
  await connection();
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) return Response.json({ error: "Essa jam não existe ou já encerrou." }, { status: 404 });
  const token = bearer(request);
  if (!hostAuthorized(room, token)) {
    return Response.json({ error: "Só o navegador que abriu a jam pode encerrar." }, { status: 401 });
  }
  endRoom(room.code);
  return Response.json({ ok: true });
}

function bearer(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
