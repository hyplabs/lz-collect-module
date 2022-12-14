import { task } from 'hardhat/config';
import { getLensHub } from './helpers/lens';

const MUMBAI_HYPE_PROFILE_ID = '0x346f'; // https://testnet.lenster.xyz/u/carlosbeltran.test
const MUMBAI_HYPE_PUB_ID = '0x03'; // https://testnet.lenster.xyz/posts/0x346f-0x03

task('stub-collect-post', 'collects our lens post').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [_, governance] = await ethers.getSigners(); // uses priv key defined in this hardhat config
  const lensHub = await getLensHub('lensHub proxy', governance.provider);

  const { maxFeePerGas, maxPriorityFeePerGas } = await lensHub.provider.getFeeData();

  console.log('lensHub.collect()');
  // NOTE: our `MUMBAI_HYPE_PUB_ID` is a limited fee collect module - you gotta pay wmatic!
  const tx = await lensHub.connect(governance).collect(
    ethers.BigNumber.from(MUMBAI_HYPE_PROFILE_ID),
    ethers.BigNumber.from(MUMBAI_HYPE_PUB_ID),
    [],
    { maxFeePerGas, maxPriorityFeePerGas, gasLimit: 500000 }
  );
  console.log(`tx: ${tx.hash}`);
  await tx.wait();
});
