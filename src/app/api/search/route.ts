import { connection, type NextRequest } from "next/server";
import { searchSongs } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  await connection();
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ results: [] });
  if (query.length > 80) {
    return Response.json({ error: "Busca longa demais." }, { status: 400 });
  }

  try {
    const results = await searchSongs(query);
    return Response.json({ results });
  } catch {
    return Response.json({ error: "Não consegui buscar agora. Tenta de novo." }, { status: 502 });
  }
}
