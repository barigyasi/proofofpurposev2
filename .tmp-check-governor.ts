import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
const governor = '0x137CDAE27838Ddb13572dDDf6bb13E982D968E97';
const abi = parseAbi([
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)'
]);

const logs = await client.getLogs({
  address: governor,
  event: abi[0],
  fromBlock: 31700000n,
  toBlock: 'latest'
});

const recent = logs.slice(-30).map((log) => ({
  blockNumber: log.blockNumber.toString(),
  txHash: log.transactionHash,
  proposalId: log.args.proposalId?.toString(),
  description: log.args.description,
}));
console.log(JSON.stringify(recent, null, 2));
