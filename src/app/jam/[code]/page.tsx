import { HostJam } from "@/components/host-jam";

export default async function JamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <HostJam code={code.toUpperCase()} />;
}
