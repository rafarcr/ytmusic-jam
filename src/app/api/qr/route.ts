import { connection, type NextRequest } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
  await connection();
  const text = request.nextUrl.searchParams.get("text") ?? "";
  if (!/^https?:\/\/[^\s]{1,500}$/i.test(text)) {
    return Response.json({ error: "Link inválido." }, { status: 400 });
  }

  const svg = await QRCode.toString(text, {
    type: "svg",
    margin: 1,
    color: { dark: "#111111", light: "#ffffff" },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
