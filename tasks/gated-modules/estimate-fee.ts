import { task } from 'hardhat/config';
import { Contract, utils, Bytes, providers, BigNumber } from 'ethers';
import { contractsDeployed } from './../../scripts/utils/migrations';
import ILayerZeroMessagingLibrary from './../helpers/ILayerZeroMessagingLibrary.json';
import { getLensHubDeployed, getFollowWithSigParts } from './../helpers/lens';
import { MAX_UINT256 } from './../../test/lens/helpers/constants';
import {
  LZ_CONFIG_GATED_MODULES,
  SANDBOX_USER_PROFILE_ID,
  TOKEN_CONTRACT,
  TOKEN_THRESHOLD,
} from './../helpers/constants';

const { ALCHEMY_MUMBAI_URL, ALCHEMY_POLYGON_URL } = process.env;

// the same can be done for LZGatedCollectModule + LZGatedReferenceModule, just need to setup the correct sig data
task('estimate-fee', 'estimate the fee of sending the followSig from source chain to remote chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  if (!(LZ_CONFIG_GATED_MODULES[networkName] && LZ_CONFIG_GATED_MODULES[networkName].remote)) throw new Error('invalid network');

  const destination = LZ_CONFIG_GATED_MODULES[networkName].remote;
  const provider = new providers.JsonRpcProvider(destination === 'mumbai' ? ALCHEMY_MUMBAI_URL : ALCHEMY_POLYGON_URL);
  const lensHub = await getLensHubDeployed('lensHub sandbox', destination, provider);
  const endpoint = new Contract(LZ_CONFIG_GATED_MODULES[networkName].endpoint, ILayerZeroMessagingLibrary.abi, deployer.provider);

  const followerAddress = await deployer.getAddress();
  const nonce = (await lensHub.sigNonces(followerAddress)).toNumber();
  const chainId = parseInt(await hre.getChainId());

  const followWithSigData = await getFollowWithSigParts({
    chainId,
    wallet: deployer,
    lensHubAddress: lensHub.address,
    profileIds: [BigNumber.from(SANDBOX_USER_PROFILE_ID)],
    datas: [[]],
    nonce,
    deadline: MAX_UINT256,
    follower: followerAddress,
  });

  // example payload
  const followWithSigType = 'tuple(address follower, uint256[] profileIds, bytes[] datas, tuple(uint8 v, bytes32 r, bytes32 s, uint256 deadline) sig) followSig';
  const types = ['address', 'address', 'uint256', 'uint256', followWithSigType];
  const payload = ethers.utils.defaultAbiCoder.encode(
    types,
    [followerAddress, TOKEN_CONTRACT, SANDBOX_USER_PROFILE_ID, TOKEN_THRESHOLD, followWithSigData]
  );

  console.log(`networkName: ${networkName}`);
  console.log(`endpoint.address: ${endpoint.address}`);

  const fees = await endpoint.estimateFees(
    LZ_CONFIG_GATED_MODULES[destination].chainId, // the destination LayerZero chainId
    contractsDeployed.LZGatedProxy, // your contract address that calls Endpoint.send()
    payload,
    false, // _payInZRO
    "0x" // default '0x' adapterParams, see: Relayer Adapter Param docs
  );

  console.log('payload types: ', types);
  console.log(`fees in ${['mumbai', 'polygon'].includes(networkName) ? 'matic' : 'ether'}`, utils.formatEther(fees[0]));
});
