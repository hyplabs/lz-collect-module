import { task } from 'hardhat/config';
import { LZ_DESTINATION_CHAINS, LZ_CONFIG } from './helpers/constants';
import deployContract from './helpers/deployContract';

let ethers: any;
let networkName: string;

task('deploy-token-remote', 'deploys OmniSBT on the destination chain').setAction(async ({}, hre) => {
  ethers = hre.ethers;
  networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();
  const { maxFeePerGas, maxPriorityFeePerGas } = await ethers.provider.getFeeData();

  let tx: any;

  if (!LZ_CONFIG[networkName]) throw new Error('invalid network');

  const IS_SOURCE = false;
  const omniSBT = await deployContract(
    ethers,
    networkName,
    'OmniSBT',
    [LZ_CONFIG[networkName].endpoint, [], [], IS_SOURCE]
  );
});
