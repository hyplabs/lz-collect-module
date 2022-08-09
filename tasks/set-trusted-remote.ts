import { task } from 'hardhat/config';
import { contractsDeployed, contractsDeployedOn } from './../scripts/utils/migrations';
import { LZ_CONFIG } from './helpers/constants';
import getContract from './helpers/getContract';

task('set-trusted-remote', 'sets trusted remote for OmniSBT on a destination chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!(LZ_CONFIG[networkName] && LZ_CONFIG[networkName].remote)) throw new Error('invalid network');

  const omniSBT = await getContract(ethers, 'OmniSBT', deployer);

  console.log('setting trusted remote');
  const { remote } = LZ_CONFIG[networkName];
  console.log(`${remote}: ${LZ_CONFIG[remote].chainId}, ${contractsDeployedOn(remote).OmniSBT}`);
  const tx = await omniSBT.setTrustedRemote(LZ_CONFIG[remote].chainId, contractsDeployedOn(remote).OmniSBT);
  console.log(`tx: ${tx.hash}`);
  await tx.wait();
});
