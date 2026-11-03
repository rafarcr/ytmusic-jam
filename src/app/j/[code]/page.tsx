import { GuestJam } from "@/components/guest-jam";

export default async function GuestPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GuestJam code={code.toUpperCase()} />;
}
