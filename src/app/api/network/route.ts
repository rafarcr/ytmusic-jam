import { connection } from "next/server";
import { lanAddresses } from "@/lib/network";

export async function GET() {
  await connection();
  return Response.json({ addresses: lanAddresses() });
}
