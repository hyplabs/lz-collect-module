import { task } from 'hardhat/config';
import { Contract, utils, Bytes } from 'ethers';
import { contractsDeployed } from './../../scripts/utils/migrations';
import { LZ_CONFIG_GATED_MODULES } from './../helpers/constants';
import ILayerZeroMessagingLibrary from './../helpers/ILayerZeroMessagingLibrary.json';
import { getLensHubDeployed } from './../helpers/lens';
import { MAX_UINT256, HARDHAT_CHAINID } from './../../test/lens/helpers/constants';

const TOKEN_CONTRACT = '0xDBF49B20eC2E48ef4CeEb79927eA4Ac2eFc2c961'; // goerli
const TOKEN_THRESHOLD = '1';
const PROFILE_ID_TO_FOLLOW = '1';

const buildFollowWithSigParams = (
  chainId: number | undefined,
  lensHubAddress: string,
  profileIds: string[] | number[],
  datas: Bytes[] | string[],
  nonce: number,
  deadline: string
) => ({
  types: {
    FollowWithSig: [
      { name: 'profileIds', type: 'uint256[]' },
      { name: 'datas', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  domain: {
    name: 'Lens Protocol Profiles',
    version: '1',
    chainId: chainId || HARDHAT_CHAINID,
    verifyingContract: lensHubAddress,
  },
  value: {
    profileIds: profileIds,
    datas: datas,
    nonce: nonce,
    deadline: deadline,
  },
});

task('estimate-fee-follow', 'estimate the fee of sending message from remote chain to source chain').setAction(async ({}, hre) => {
  const ethers = hre.ethers;
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  // using the sandbox deployment for module whitelisting
  const lensHub = await getLensHubDeployed('lensHub sandbox', deployer);

  if (!(LZ_CONFIG_GATED_MODULES[networkName] && LZ_CONFIG_GATED_MODULES[networkName].remote)) throw new Error('invalid network');

  const endpoint = new Contract(LZ_CONFIG_GATED_MODULES[networkName].endpoint, ILayerZeroMessagingLibrary.abi, deployer.provider);

  const destination = LZ_CONFIG_GATED_MODULES[networkName].remote;

  const followerAddress = await deployer.getAddress();
  let nonce;
  try {
    nonce = (await lensHub.sigNonces(followerAddress)).toNumber()
  } catch (error) {
    nonce = 0;
  }

  const msgParams = buildFollowWithSigParams(
    hre.network.config.chainId,
    lensHub.address,
    [PROFILE_ID_TO_FOLLOW],
    [[]],
    nonce,
    MAX_UINT256
  );
  const sig = await deployer._signTypedData(msgParams.domain, msgParams.types, msgParams.value);
  const { v, r, s } = ethers.utils.splitSignature(sig);

  const followWithSigData = {
    follower: followerAddress,
    profileIds: [PROFILE_ID_TO_FOLLOW],
    datas: [[]],
    sig: {
      v,
      r,
      s,
      deadline: MAX_UINT256,
    },
  };

  // dummy payload
  const followWithSigType = 'tuple(address follower, uint256[] profileIds, bytes[] datas, tuple(uint8 v, bytes32 r, bytes32 s, uint256 deadline) sig) followSig';
  const types = ['address', 'address', 'uint256', 'uint256', followWithSigType];
  const payload = ethers.utils.defaultAbiCoder.encode(
    types,
    [followerAddress, TOKEN_CONTRACT, PROFILE_ID_TO_FOLLOW, TOKEN_THRESHOLD, followWithSigData]
  );

  console.log(`endpoint.estimateFees(
    ${LZ_CONFIG_GATED_MODULES[destination].chainId},
    ${contractsDeployed.LZGatedProxy},
    ${payload},
    ${false},
    ${"0x"}
  )`);

  // @TODO: missing revert data in call exception; Transaction reverted without a reason string
  const fees = await endpoint.estimateFees(
    LZ_CONFIG_GATED_MODULES[destination].chainId, // the destination LayerZero chainId
    contractsDeployed.LZGatedProxy, // your contract address that calls Endpoint.send()
    payload,
    false, // _payInZRO
    "0x" // default '0x' adapterParams, see: Relayer Adapter Param docs
  );

  console.log('payload types', types);
  console.log('fees in eth', utils.formatEther(fees[0]));
});
