import { task } from 'hardhat/config';
import { LZ_CONFIG } from './helpers/constants';
import deployContract from './helpers/deployContract';

task('deploy-token-remote', 'deploys OmniSBT on the destination chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!LZ_CONFIG[networkName]) throw new Error('invalid network');

  const IS_SOURCE = false;
  const omniSBT = await deployContract(
    ethers,
    networkName,
    'OmniSBT',
    [LZ_CONFIG[networkName].endpoint, [], [], IS_SOURCE]
  );
});
