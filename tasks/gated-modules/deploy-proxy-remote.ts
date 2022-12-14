import { task } from 'hardhat/config';
import { LZ_CONFIG_GATED_MODULES } from './../helpers/constants';
import deployContract from './../helpers/deployContract';
import { contractsDeployedOn } from './../../scripts/utils/migrations';

const SOURCE_NETWORK_NAME = 'mumbai'; // @TODO: flip to polygon

task('deploy-proxy-remote', 'deploys LZGatedProxy on a remote chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!LZ_CONFIG_GATED_MODULES[networkName]) throw new Error('invalid network');

  // modules deployed on the source chain
  const contracts = contractsDeployedOn(SOURCE_NETWORK_NAME);

  console.log(`deploying LZGatedProxy on networkName: ${networkName}...`);
  const lzGatedProxy = await deployContract(
    ethers,
    networkName,
    'LZGatedProxy',
    [
      LZ_CONFIG_GATED_MODULES[networkName].endpoint,
      LZ_CONFIG_GATED_MODULES[SOURCE_NETWORK_NAME].chainId,
      contracts.LZGatedFollowModule,
      contracts.LZGatedReferenceModule,
      contracts.LZGatedCollectModule
    ]
  );
});
