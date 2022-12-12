import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Signer, VoidSigner } from 'ethers';
const { getContractAddress } = require('@ethersproject/address');
import { ethers } from 'hardhat';
import {
  FIRST_PROFILE_ID,
  MOCK_URI,
  governance,
  lensHub,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  user,
  userTwo,
  userThree,
  testWallet,
} from './lens/__setup.spec';
import { ERRORS } from './lens/helpers/errors';
import { getFollowWithSigParts } from './lens/helpers/utils';
import { ZERO_ADDRESS, MAX_UINT256 } from './lens/helpers/constants';
import {
  LZGatedFollowModule,
  LZGatedFollowModule__factory,
  LZGatedProxy,
  LZGatedProxy__factory,
  LZEndpointMock,
  LZEndpointMock__factory,
  ERC721Mock,
  ERC721Mock__factory,
  ERC20Mock,
  ERC20Mock__factory,
} from '../typechain-types'
import { abi } from './lens/abi/Events.json';
import { FollowNFT__factory } from '../typechain-types-lens';
import LZGatedFollowModuleABI from './../build/contracts/LZGatedFollowModule.sol/LZGatedFollowModule.json';
import { parseLogsNested } from './utils/parseLogs';

const EMPTY_BYTES = '0x';
const REMOTE_CHAIN_ID = 123;
const BALANCE_THRESHOLD = 1;

makeSuiteCleanRoom('LZGatedFollowModule', function () {
  let lzGatedProxy: LZGatedProxy;
  let lzEndpoint: LZEndpointMock;
  let followModule: LZGatedFollowModule;
  let erc721: ERC721Mock;
  let erc20: ERC20Mock;
  let deployer: Signer, user: Signer, userTwo: Signer, userThree: Signer;
  let deployerAddress: string, userAddress: string, userTwoAddress: string;

  const setFollowModule = async ({
    tokenContract = erc721.address,
    tokenThreshold = BALANCE_THRESHOLD,
    chainId = REMOTE_CHAIN_ID
  }) => {
    const followModuleInitData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint16'],
      [tokenContract, tokenThreshold, chainId]
    );

    return await lensHub.setFollowModule(FIRST_PROFILE_ID, followModule.address, followModuleInitData);
  };

  const getNonBlockingError = (receipt) => {
    const logs = parseLogsNested(receipt, abi, LZGatedFollowModuleABI.abi);
    const event = logs.find(({ name }) => name === 'MessageFailed');

    return event.args._reason;
  };

  beforeEach(async () => {
    ([deployer, user, userTwo, userThree] = await ethers.getSigners());
    deployerAddress = await deployer.getAddress();
    userAddress = await user.getAddress();
    userTwoAddress = await userTwo.getAddress();

    lzEndpoint = await new LZEndpointMock__factory(deployer).deploy(REMOTE_CHAIN_ID);
    const transactionCount = await deployer.getTransactionCount();
    const followModuleAddress = getContractAddress({ from: deployerAddress, nonce: transactionCount + 1 });

    lzGatedProxy = await new LZGatedProxy__factory(deployer).deploy(
      lzEndpoint.address,
      REMOTE_CHAIN_ID,
      followModuleAddress,
      ZERO_ADDRESS, // _remoteReferenceModule
      ZERO_ADDRESS // _remoteCollectModule
    );
    followModule = await new LZGatedFollowModule__factory(deployer).deploy(
      lensHub.address,
      lzEndpoint.address,
      [REMOTE_CHAIN_ID],
      [lzGatedProxy.address]
    );
    erc721 = await new ERC721Mock__factory(deployer).deploy();
    erc20 = await new ERC20Mock__factory(deployer).deploy();

    // use same lz endpoint mock
    await lzEndpoint.setDestLzEndpoint(followModule.address, lzEndpoint.address);
    await lzEndpoint.setDestLzEndpoint(lzGatedProxy.address, lzEndpoint.address);

    await lensHub.connect(governance).whitelistFollowModule(followModule.address, true);

    await lensHub.createProfile({
      to: userAddress,
      handle: MOCK_PROFILE_HANDLE,
      imageURI: MOCK_PROFILE_URI,
      followModule: ZERO_ADDRESS,
      followModuleInitData: [],
      followNFTURI: MOCK_FOLLOW_NFT_URI,
    });
  });

  describe('#constructor', () => {
    it('reverts when the hub arg is the null address', async () => {
      expect(
        new LZGatedFollowModule__factory(deployer).deploy(ZERO_ADDRESS, lzEndpoint.address, [], [])
      ).to.be.revertedWith('InitParamsInvalid');
    });

    it('sets storage', async () => {
      const owner = await followModule.owner();
      const endpoint = await followModule.lzEndpoint();

      expect(owner).to.equal(deployerAddress);
      expect(endpoint).to.equal(lzEndpoint.address);
    });
  });

  describe('#initializeFollowModule', () => {
    it('reverts when the caller is not LensHub', async () => {
      await expect(
        followModule.initializeFollowModule(FIRST_PROFILE_ID, EMPTY_BYTES)
      ).to.be.revertedWith(ERRORS.NOT_HUB);
    });

    it('reverts when an invalid chain id is provided in the encoded data', async () => {
      const followModuleInitData = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint16'],
        [erc721.address, BALANCE_THRESHOLD, 12345]
      );

      await expect(
        lensHub.setFollowModule(FIRST_PROFILE_ID, followModule.address, followModuleInitData)
      ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
    });

    it('reverts when token contract as zero address is provided in the encoded data', async () => {
      const followModuleInitData = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint16'],
        [ZERO_ADDRESS, BALANCE_THRESHOLD, REMOTE_CHAIN_ID]
      );

      await expect(
        lensHub.setFollowModule(FIRST_PROFILE_ID, followModule.address, followModuleInitData)
      ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
    });

    context('context: with valid params', () => {
      let tx;

      beforeEach(async() => {
        tx = await setFollowModule({
          tokenContract: erc721.address,
          tokenThreshold: BALANCE_THRESHOLD,
          chainId: REMOTE_CHAIN_ID
        });
      });

      it('sets storage', async () => {
        const res = await followModule.gatedFollowPerProfile(FIRST_PROFILE_ID);

        expect(res.balanceThreshold.toNumber()).to.equal(BALANCE_THRESHOLD);
        expect(res.tokenContract).to.equal(erc721.address);
        expect(res.remoteChainId).to.equal(REMOTE_CHAIN_ID);
      });

      it('emits an event', async () => {
        const logs = parseLogsNested(await tx.wait(), abi, LZGatedFollowModuleABI.abi);
        const event = logs.find(({ name }) => name === 'InitFollowModule');

        expect(event).not.to.equal(undefined);
        expect(event.args.profileId.toNumber()).to.equal(FIRST_PROFILE_ID);
        expect(event.args.tokenContract).to.equal(erc721.address);
        expect(event.args.chainId).to.equal(REMOTE_CHAIN_ID);
      });
    });
  });

  describe('#processFollow (triggered from LZGatedProxy#relayFollowWithSig)', () => {
    let followWithSigData;

    beforeEach(async() => {
      await setFollowModule({
        tokenContract: erc721.address,
        tokenThreshold: BALANCE_THRESHOLD,
        chainId: REMOTE_CHAIN_ID
      });

      const nonce = (await lensHub.sigNonces(userAddress)).toNumber();
      const { v, r, s } = await getFollowWithSigParts(
        user as VoidSigner,
        [FIRST_PROFILE_ID],
        [[]],
        nonce,
        MAX_UINT256
      );

      followWithSigData = {
        follower: userAddress,
        profileIds: [FIRST_PROFILE_ID],
        datas: [[]],
        sig: {
          v,
          r,
          s,
          deadline: MAX_UINT256,
        },
      };
    });

    it('reverts if called without going through lzGatedProxy', async () => {
      await expect(
        lensHub.followWithSig(followWithSigData)
      ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
    });

    it('reverts if the caller does not have suffient balance', async () => {
      await expect(
        lzGatedProxy
          .connect(user)
          .relayFollowWithSig(
            userAddress,
            FIRST_PROFILE_ID,
            erc721.address,
            BALANCE_THRESHOLD,
            followWithSigData
          )
      ).to.be.revertedWith('InsufficientBalance');
    });

    it('reverts if the contract call for balanceOf() fails', async () => {
      await expect(
        lzGatedProxy
          .connect(user)
          .relayFollowWithSig(
            userAddress,
            FIRST_PROFILE_ID,
            lzEndpoint.address,
            BALANCE_THRESHOLD,
            followWithSigData
          )
      ).to.be.revertedWith('InsufficientBalance');
    });

    it('[non-blocking] fails if the caller passed an invalid threshold', async () => {
      await erc721.safeMint(userAddress);

      const tx = await lzGatedProxy
        .connect(user)
        .relayFollowWithSig(
          userAddress,
          FIRST_PROFILE_ID,
          erc721.address,
          0,
          followWithSigData
        );

      const messageFailedReason = getNonBlockingError(await tx.wait());
      expect(messageFailedReason).to.equal('InvalidRemoteInput');
    });


    it('[non-blocking] fails if the caller passed an invalid token contract', async () => {
      await erc20.mint(userAddress, BALANCE_THRESHOLD);

      const tx = await lzGatedProxy
        .connect(user)
        .relayFollowWithSig(
          userAddress,
          FIRST_PROFILE_ID,
          erc20.address,
          BALANCE_THRESHOLD,
          followWithSigData
        );

      const messageFailedReason = getNonBlockingError(await tx.wait());
      expect(messageFailedReason).to.equal('InvalidRemoteInput');
    });

    it('processes a valid follow', async () => {
      await erc721.safeMint(userAddress);

      const tx = await lzGatedProxy
        .connect(user)
        .relayFollowWithSig(
          userAddress,
          FIRST_PROFILE_ID,
          erc721.address,
          BALANCE_THRESHOLD,
          followWithSigData
        );
      const logs = parseLogsNested(await tx.wait(), abi, LZGatedFollowModuleABI.abi);
      const event = logs.find(({ name }) => name === 'MessageFailed');

      expect(event).to.equal(undefined);

      const followNFTAddress = await lensHub.getFollowNFT(FIRST_PROFILE_ID);
      const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
      const id = await followNFT.tokenOfOwnerByIndex(userAddress, 0);
      expect(id).to.eq(1);
    });

    /**
    * NOTE: it reverts here in the test because we mocked lzEndpoint; it should actually just fail (emit error)
    */
    it('reverts if the same signature is used', async () => {
      await erc721.safeMint(userAddress);

      await lzGatedProxy
        .connect(user)
        .relayFollowWithSig(
          userAddress,
          FIRST_PROFILE_ID,
          erc721.address,
          BALANCE_THRESHOLD,
          followWithSigData
        );

      await expect(
        lzGatedProxy
          .connect(user)
          .relayFollowWithSig(
            userAddress,
            FIRST_PROFILE_ID,
            erc721.address,
            BALANCE_THRESHOLD,
            followWithSigData
          )
      ).to.be.reverted; // pretty sure the revert is sig-related but no reason is provided
    });
  });
});
