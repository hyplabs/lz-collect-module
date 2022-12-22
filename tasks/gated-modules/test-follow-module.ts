import { task } from 'hardhat/config';
import { Contract, utils, Bytes, providers, BigNumber } from 'ethers';
import getContract from './../helpers/getContract';
import { getLensHubDeployed, getFollowWithSigParts } from './../helpers/lens';
import { MAX_UINT256 } from './../../test/lens/helpers/constants';
import {
  LZ_CONFIG_GATED_MODULES,
  SANDBOX_USER_PROFILE_ID,
  SANDBOX_USER_PROFILE_ID_USER,
  TOKEN_CONTRACT,
  TOKEN_THRESHOLD,
} from './../helpers/constants';

const { ALCHEMY_MUMBAI_URL, ALCHEMY_POLYGON_URL } = process.env;

const ESTIMATED_FOLLOW_FEE_GWEI = '2500'; // derived from `npx hardhat estimate-fee-gated`
const ESTIMATED_GAS = 250000;
const REMOTE_CHAIN_IDS = { 'mumbai': 80001, 'polygon': 137 };

// the same can be done for LZGatedCollectModule + LZGatedReferenceModule, just need to setup the correct sig data
task('test-follow-module', 'try to folllow a profile which has set their follow module to LZGatedFollowModule').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer, governance, user] = await ethers.getSigners();

  if (!(LZ_CONFIG_GATED_MODULES[networkName] && LZ_CONFIG_GATED_MODULES[networkName].remote)) throw new Error('invalid network');

  const destination = 'mumbai'; //LZ_CONFIG_GATED_MODULES[networkName].remote;
  const provider = new providers.JsonRpcProvider(destination === 'mumbai' ? ALCHEMY_MUMBAI_URL : ALCHEMY_POLYGON_URL);
  const lensHub = await getLensHubDeployed('lensHub sandbox', destination, provider);
  const lzGatedProxy = await getContract(ethers, 'LZGatedProxy', deployer);

  const followerAddress = await governance.getAddress();
  const nonce = (await lensHub.sigNonces(followerAddress)).toNumber();
  const chainId = REMOTE_CHAIN_IDS[destination];

  const followWithSigData = await getFollowWithSigParts({
    chainId,
    wallet: governance,
    lensHubAddress: lensHub.address,
    profileIds: [SANDBOX_USER_PROFILE_ID],
    datas: [[]],
    nonce,
    deadline: MAX_UINT256,
    follower: followerAddress,
  });

  console.log(`followWithSigData:`);
  console.log(JSON.stringify(followWithSigData,null,2));

  const ESTIMATED_GAS_REMOTE = 500_000 // based on some tests...
  const GAS_LIMIT = 250_000;
  console.log('lzGatedProxy.relayFollowWithSig()');
  const tx = await lzGatedProxy.relayFollowWithSig(
    TOKEN_CONTRACT,
    TOKEN_THRESHOLD,
    followWithSigData,
    ESTIMATED_GAS_REMOTE,
    { value: utils.parseUnits(ESTIMATED_FOLLOW_FEE_GWEI, 'gwei'), gasLimit: GAS_LIMIT }
  );
  console.log(`tx: ${tx.hash}`);
  await tx.wait();

  // assuming `followerAddress` has a balance of `TOKEN_CONTRACT` >= `TOKEN_THRESHOLD` - likely good
  // check the latext tx against the deployed LZGatedFollowModule
});
