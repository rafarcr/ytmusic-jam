import { connection } from "next/server";
import { createRoom } from "@/lib/rooms";

export async function POST() {
  await connection();
  const room = createRoom();
  return Response.json({
    code: room.code,
    hostToken: room.hostToken,
    expiresAt: room.expiresAt,
  });
}
