import { getContract, readContract } from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS_V2 } from "@/config/contracts";
import receiptAbi from "@/contracts/abis/ReceiptNFT.json";

export type DecodedReceipt = {
  tokenId: string;
  metadata: {
    name: string;
    description: string;
    image: string; // data:image/svg+xml;base64,...
    attributes: Array<{ trait_type: string; value: string | number; display_type?: string }>;
  } | null;
  svg: string; // raw SVG markup
};

function chargeIdToBytes32(uuid: string): `0x${string}` {
  return ("0x" + uuid.replace(/-/g, "").padStart(64, "0")) as `0x${string}`;
}

function getReceiptContract() {
  if (!CONTRACTS_V2.RECEIPT_NFT) throw new Error("Receipt NFT contract not configured");
  return getContract({
    client: thirdwebClient,
    chain: baseChain,
    address: CONTRACTS_V2.RECEIPT_NFT as `0x${string}`,
    abi: receiptAbi.abi as any,
  });
}

function b64decode(s: string): string {
  if (typeof atob === "function") return atob(s);
  return Buffer.from(s, "base64").toString("binary");
}

export async function fetchReceipt(tokenId: string | number): Promise<DecodedReceipt> {
  const contract = getReceiptContract();
  const uri = (await readContract({
    contract,
    method: "function tokenURI(uint256) view returns (string)",
    params: [BigInt(tokenId)],
  })) as string;
  const jsonPart = uri.replace(/^data:application\/json;base64,/, "");
  let metadata: DecodedReceipt["metadata"] = null;
  let svg = "";
  try {
    const decoded = b64decode(jsonPart);
    metadata = JSON.parse(decoded);
    if (metadata?.image?.startsWith("data:image/svg+xml;base64,")) {
      svg = b64decode(metadata.image.replace(/^data:image\/svg\+xml;base64,/, ""));
    }
  } catch (e) {
    console.error("decode receipt failed", e);
  }
  return { tokenId: String(tokenId), metadata, svg };
}

export async function tokenIdForCharge(chargeUuid: string): Promise<string | null> {
  const contract = getReceiptContract();
  const id = (await readContract({
    contract,
    method: "function tokenIdForCharge(bytes32) view returns (uint256)",
    params: [chargeIdToBytes32(chargeUuid)],
  })) as bigint;
  return id > 0n ? id.toString() : null;
}

export function svgToPngDataUrl(svg: string, size = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas ctx"));
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
