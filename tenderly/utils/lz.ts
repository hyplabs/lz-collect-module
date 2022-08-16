import { Contract, utils } from 'ethers';
import ILayerZeroMessagingLibrary from './abi/ILayerZeroMessagingLibrary.json';
import { MUMBAI_OMNISBT_ADDRESS } from './omniSBT';

export const LZ_CONFIG = {
  fantom_testnet: {
    chainId: '10012',
    endpoint: '0x7dcAD72640F835B0FA36EFD3D6d3ec902C7E5acf',
    remote: 'mumbai'
  },
  bsc_testnet: {
    chainId: '10002',
    endpoint: '0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1',
    remote: 'mumbai'
  },
  '80001': {
    chainId: '10009',
    endpoint: '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8',
    remotes: ['fantom_testnet', 'bsc_testnet']
  },
};

export const estimateFee = async (
  provider: any,
  networkId: string,
  address: string,
  collectionId: number,
  stubTokenId = 1, // ideally we read this from the destination contract
  stubUri = 'ipfs://QmfJ3ET9FjpV4X9oTi5T2aDZjg4h3pnwr7Au242c5RZH6b' // ^ same
) => {
  const endpoint = new Contract(LZ_CONFIG[networkId].endpoint, ILayerZeroMessagingLibrary.abi, provider);
  const destination = LZ_CONFIG[networkId].remotes[1]; // bsc_testnet

  const payload = utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'uint256', 'string'],
    [address, collectionId, stubTokenId, stubUri]
  );

  return await endpoint.estimateFees(
    LZ_CONFIG[destination].chainId, // the destination LayerZero chainId
    MUMBAI_OMNISBT_ADDRESS, // our contract that calls Endpoint.send()
    payload,
    false, // _payInZRO
    "0x" // default '0x' adapterParams, see: Relayer Adapter Param docs
  );
}
