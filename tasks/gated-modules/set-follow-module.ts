import { task } from 'hardhat/config';
import {
  LZ_CONFIG_GATED_MODULES,
  SANDBOX_USER_PROFILE_ID,
  TOKEN_CONTRACT,
  TOKEN_THRESHOLD,
  TOKEN_CHAIN_ID,
} from './../helpers/constants';
import { getLensHubDeployed } from './../helpers/lens';
import { contractsDeployed } from './../../scripts/utils/migrations';

task('set-follow-module', 'sets the LZGatedFollowModule on our test profile').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!LZ_CONFIG_GATED_MODULES[networkName]) throw new Error('invalid network');

  // using the sandbox deployment for module whitelisting
  const lensHub = await getLensHubDeployed('lensHub sandbox', networkName, deployer.provider);

  // tokenContract, balanceThreshold, chainId
  const data = ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'uint16'],
    [TOKEN_CONTRACT, TOKEN_THRESHOLD, TOKEN_CHAIN_ID]
  );

  // `SANDBOX_USER_PROFILE_ID` profile was created thru MockProfileCreationProxy, owned by `deployer`
  // https://docs.lens.xyz/docs/deployed-contract-addresses#sandbox-mumbai-testnet-addresses

  console.log('lensHub.setFollowModule()')
  const tx = await lensHub.connect(deployer).setFollowModule(
    SANDBOX_USER_PROFILE_ID,
    contractsDeployed.LZGatedFollowModule,
    data,
    { gasLimit: 210000 }
  );
  console.log(`tx: ${tx.hash}`);
  await tx.wait();

  console.log('follow module set!');
});
