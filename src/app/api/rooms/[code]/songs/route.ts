import { connection, type NextRequest } from "next/server";
import { addSong } from "@/lib/rooms";

export async function POST(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Pedido inválido." }, { status: 400 });

  const result = addSong(code, body, clientIp(request));
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ song: result.song, room: result.room });
}

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip") ?? "local";
}
