import { task } from 'hardhat/config';
import { LZ_CONFIG_GATED_MODULES } from './../helpers/constants';
import deployContract from './../helpers/deployContract';
import { contractsDeployedOn } from './../../scripts/utils/migrations';

task('deploy-proxy-remote', 'deploys LZGatedProxy on a remote chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!LZ_CONFIG_GATED_MODULES[networkName]) throw new Error('invalid network');

  const sourceNetwork = LZ_CONFIG_GATED_MODULES[networkName].remote;

  // modules deployed on the source chain
  const contracts = contractsDeployedOn(sourceNetwork);

  console.log(`deploying LZGatedProxy on remote: ${networkName} with source: ${sourceNetwork}...`);
  const lzGatedProxy = await deployContract(
    ethers,
    networkName,
    'LZGatedProxy',
    [
      LZ_CONFIG_GATED_MODULES[networkName].endpoint,
      LZ_CONFIG_GATED_MODULES[sourceNetwork].chainId,
      contracts.LZGatedFollowModule,
      contracts.LZGatedReferenceModule,
      contracts.LZGatedCollectModule
    ]
  );
});
