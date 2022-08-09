import { task } from 'hardhat/config';
import { contractsDeployedOn } from './../scripts/utils/migrations';
import { LZ_CONFIG } from './helpers/constants';
import getContract from './helpers/getContract';

const MUMBAI_FIRST_COLLECTION_URI = 'ipfs://QmP1MrJqxLB5tmcUAoJRjGW8RuHuVtXCnNDjMp8vVKZduw';
const MUMBAI_LENS_GOVERNANCE = '0xc783df8a850f42e7F7e57013759C285caa701eB6';

task('stub-create-collection', '[STUB] creates a collection on our OmniSBT contract (stubs LZCollectModule)').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();
  const { maxFeePerGas, maxPriorityFeePerGas } = await ethers.provider.getFeeData();

  const omniSBT = await getContract(ethers, 'OmniSBT', deployer);

  console.log('createCollection');
  let tx = await omniSBT.createCollection(MUMBAI_FIRST_COLLECTION_URI);
  console.log(`tx: ${tx.hash}`);
  await tx.wait();

  // doing this until lens whitelist
  console.log('setCollectModule (lens governance)');
  tx = await omniSBT.setCollectModule(MUMBAI_LENS_GOVERNANCE);
  console.log(`tx: ${tx.hash}`);
  await tx.wait();
});
