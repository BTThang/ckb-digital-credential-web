import { EXPLORER_URL } from "@/config";

export function txExplorerUrl(txHash: string): string {
  return `${EXPLORER_URL}/transaction/${txHash}`;
}

export function addressExplorerUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
