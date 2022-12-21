import { task } from 'hardhat/config';
import { LZ_CONFIG_GATED_MODULES } from './../helpers/constants';
import getContract from './../helpers/getContract';
import { contractsDeployedOn } from './../../scripts/utils/migrations';

// worst case, in the case of a revert
task('force-resume-receive', 'force our lz contract to receive new messages after a revert').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!LZ_CONFIG_GATED_MODULES[networkName]) throw new Error('invalid network');

  const followModule = await getContract(ethers, 'LZGatedFollowModule', deployer);
  // const referenceModule = await getContract(ethers, 'LZGatedReferenceModule', deployer);
  // const collectModule = await getContract(ethers, 'LZGatedCollectModule', deployer);

  const REMOTE = 'goerli';
  const { LZGatedProxy } = contractsDeployedOn(REMOTE);

  const trustedRemote = ethers.utils.solidityPack(['address','address'], [LZGatedProxy, followModule.address]);
  const tx = await followModule.forceResumeReceive(LZ_CONFIG_GATED_MODULES[REMOTE].chainId, trustedRemote);
  console.log(`tx: ${tx.hash}`);
  await tx.wait();

  console.log('done!');
});
