import os from "os";

const SKIP_ADAPTER = /loopback|virtual|vethernet|wsl|hyper-v|bluetooth|vmware|vbox|docker|npcap/i;

export function lanAddresses(): string[] {
  const found: { address: string; score: number }[] = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    if (SKIP_ADAPTER.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.internal || address.family !== "IPv4") continue;
      if (address.address.startsWith("169.254.")) continue;
      const score = address.address.startsWith("192.168.")
        ? 0
        : address.address.startsWith("10.")
          ? 1
          : 2;
      found.push({ address: address.address, score });
    }
  }
  found.sort((a, b) => a.score - b.score || a.address.localeCompare(b.address));
  return found.map((entry) => entry.address);
}
