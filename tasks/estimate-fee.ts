import { task } from 'hardhat/config';
import { Contract, utils } from 'ethers';
import { contractsDeployed } from './../scripts/utils/migrations';
import { LZ_CONFIG } from './helpers/constants';
import ILayerZeroMessagingLibrary from './helpers/ILayerZeroMessagingLibrary.json';

task('estimate-fee', 'estimate the fee of sending message from source chain to destination chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!(LZ_CONFIG[networkName] && LZ_CONFIG[networkName].remotes?.length)) throw new Error('invalid network');

  const endpoint = new Contract(LZ_CONFIG[networkName].endpoint, ILayerZeroMessagingLibrary.abi, deployer.provider);

  const destination = LZ_CONFIG[networkName].remotes[0];

  // dummy payload
  const types = ['address', 'uint256', 'uint256', 'string'];
  const payload = ethers.utils.defaultAbiCoder.encode(
    types,
    [await deployer.getAddress(), 1, 1, 'ipfs://QmfJ3ET9FjpV4X9oTi5T2aDZjg4h3pnwr7Au242c5RZH6b']
  );

  const ESTIMATED_GAS = 750_000 // based on some tests...
  const adapterParams = ethers.utils.defaultAbiCoder.encode(
    ['uint16', 'uint256'],
    [1, ESTIMATED_GAS]
  );

  const fees = await endpoint.estimateFees(
    LZ_CONFIG[destination].chainId, // the destination LayerZero chainId
    contractsDeployed.OmniSBT, // your contract address that calls Endpoint.send()
    payload,
    false, // _payInZRO
    adapterParams // https://layerzero.gitbook.io/docs/evm-guides/advanced/relayer-adapter-parameters 
  );

  console.log('payload types', types);
  console.log('fees in eth', utils.formatEther(fees[0]));
});
