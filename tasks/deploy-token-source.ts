import { task } from 'hardhat/config';
import { contractsDeployedOn } from './../scripts/utils/migrations';
import { LZ_CONFIG } from './helpers/constants';
import deployContract from './helpers/deployContract';
import getContract from './helpers/getContract';

task('deploy-token-source', 'deploys OmniSBT on the source chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!LZ_CONFIG[networkName]) throw new Error('invalid network');

  const IS_SOURCE = true;
  const remoteChainIds = LZ_CONFIG[networkName].remotes.map((n) => LZ_CONFIG[n].chainId);
  const remoteContracts = LZ_CONFIG[networkName].remotes.map((n) => contractsDeployedOn(n).OmniSBT);

  const omniSBT = await deployContract(
    ethers,
    networkName,
    'OmniSBT',
    [LZ_CONFIG[networkName].endpoint, remoteChainIds, remoteContracts, IS_SOURCE]
  );

  console.log('[STUB] set collect module');
  await omniSBT.setCollectModule(await deployer.getAddress());

  // IF ALREADY DEPLOYED, COMMENT LINES 18-26 ABOVE AND UNCOMMENT BELOW
  // const omniSBT = await getContract(ethers, 'OmniSBT', deployer);

  // console.log('setting trusted remotes');
  // await Promise.all(LZ_CONFIG[networkName].remotes.map(async(n, idx) => {
  //   console.log(`${n}: ${remoteChainIds[idx]}, ${remoteContracts[idx]}`);
  //   const tx = await omniSBT.setTrustedRemote(remoteChainIds[idx], remoteContracts[idx]);
  //   console.log(`tx: ${tx.hash}`);
  //   await tx.wait();
  // }));
});
