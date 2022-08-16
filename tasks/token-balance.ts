import { task } from 'hardhat/config';
import getContract from './helpers/getContract';

task('token-balance', 'check our token balance on the destination chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  const omniSBT = await getContract(ethers, 'OmniSBT', deployer);

  const COLLECTOR = '0xc783df8a850f42e7F7e57013759C285caa701eB6';
  const bal = await omniSBT.balanceOf(COLLECTOR);
  console.log(bal.toNumber());
});
