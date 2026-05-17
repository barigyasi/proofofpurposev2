import { createPublicClient, http, getContract } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;
const usdc = getContract({ address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', abi: erc20Abi, client });
const purpose = getContract({ address: '0xd9a710A1ED0b73f487C4cF55580B71bBfc6B869f', abi: erc20Abi, client });
const treasury = '0xB452b6A36954fafB0342220B2C7a6c47925Eec44';
const [usdcWei, supplyWei] = await Promise.all([usdc.read.balanceOf([treasury]), purpose.read.totalSupply()]);
console.log(JSON.stringify({ usdcWei: usdcWei.toString(), supplyWei: supplyWei.toString(), backing: Number(usdcWei)/1e6, outstanding: Number(supplyWei)/1e18 }, null, 2));
