import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Signer, VoidSigner } from 'ethers';
const { getContractAddress } = require('@ethersproject/address');
import { ethers } from 'hardhat';
import {
  FIRST_PROFILE_ID,
  MOCK_URI,
  OTHER_MOCK_URI,
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
  freeCollectModule,
} from './lens/__setup.spec';
import { ERRORS } from './lens/helpers/errors';
import { getCommentWithSigParts, getMirrorWithSigParts } from './lens/helpers/utils';
import { ZERO_ADDRESS, MAX_UINT256 } from './lens/helpers/constants';
import {
  LZGatedReferenceModule,
  LZGatedReferenceModule__factory,
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
import LZGatedReferenceModuleABI from './../build/contracts/LZGatedReferenceModule.sol/LZGatedReferenceModule.json';
import { parseLogsNested } from './utils/parseLogs';

const EMPTY_BYTES = '0x';
const REMOTE_CHAIN_ID = 123;
const BALANCE_THRESHOLD = 1;

makeSuiteCleanRoom('LZGatedReferenceModule', function () {
  let lzGatedProxy: LZGatedProxy;
  let lzEndpoint: LZEndpointMock;
  let referenceModule: LZGatedReferenceModule;
  let erc721: ERC721Mock;
  let erc20: ERC20Mock;
  let deployer: Signer, user: Signer, userTwo: Signer, userThree: Signer;
  let deployerAddress: string, userAddress: string, userTwoAddress: string;

  const getNonBlockingError = (receipt) => {
    const logs = parseLogsNested(receipt, abi, LZGatedReferenceModuleABI.abi);
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
    const referenceModuleAddress = getContractAddress({ from: deployerAddress, nonce: transactionCount + 1 });

    lzGatedProxy = await new LZGatedProxy__factory(deployer).deploy(
      lzEndpoint.address,
      REMOTE_CHAIN_ID,
      ZERO_ADDRESS, // _remoteFollowModule
      referenceModuleAddress,
      ZERO_ADDRESS // _remoteCollectModule
    );
    referenceModule = await new LZGatedReferenceModule__factory(deployer).deploy(
      lensHub.address,
      lzEndpoint.address,
      [REMOTE_CHAIN_ID],
      [lzGatedProxy.address]
    );
    erc721 = await new ERC721Mock__factory(deployer).deploy();
    erc20 = await new ERC20Mock__factory(deployer).deploy();

    // use same lz endpoint mock
    await lzEndpoint.setDestLzEndpoint(referenceModule.address, lzEndpoint.address);
    await lzEndpoint.setDestLzEndpoint(lzGatedProxy.address, lzEndpoint.address);

    await lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
    await lensHub.connect(governance).whitelistReferenceModule(referenceModule.address, true);

    await lensHub.createProfile({
      to: userAddress,
      handle: MOCK_PROFILE_HANDLE,
      imageURI: MOCK_PROFILE_URI,
      followModule: ZERO_ADDRESS,
      followModuleInitData: [],
      followNFTURI: MOCK_FOLLOW_NFT_URI,
    });

    await lensHub.createProfile({
      to: userTwoAddress,
      handle: 'test.lens',
      imageURI: MOCK_PROFILE_URI,
      followModule: ZERO_ADDRESS,
      followModuleInitData: [],
      followNFTURI: MOCK_FOLLOW_NFT_URI,
    });
  });

  describe('#constructor', () => {
    it('reverts when the hub arg is the null address', async () => {
      expect(
        new LZGatedReferenceModule__factory(deployer).deploy(ZERO_ADDRESS, lzEndpoint.address, [], [])
      ).to.be.revertedWith('InitParamsInvalid');
    });

    it('sets storage', async () => {
      const owner = await referenceModule.owner();
      const endpoint = await referenceModule.lzEndpoint();

      expect(owner).to.equal(deployerAddress);
      expect(endpoint).to.equal(lzEndpoint.address);
    });
  });

  describe('#initializeReferenceModule', () => {
    it('reverts when the caller is not LensHub', async () => {
      await expect(
        referenceModule.initializeReferenceModule(FIRST_PROFILE_ID, 1, EMPTY_BYTES)
      ).to.be.revertedWith(ERRORS.NOT_HUB);
    });

    it('reverts when an invalid chain id is provided in the encoded data', async () => {
      const referenceModuleInitData = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint16'],
        [erc721.address, BALANCE_THRESHOLD, 12345]
      );

      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: freeCollectModule.address,
          collectModuleInitData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
          referenceModule: referenceModule.address,
          referenceModuleInitData: referenceModuleInitData,
        })
      ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
    });

    it('reverts when token contract as zero address is provided in the encoded data', async () => {
      const referenceModuleInitData = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint16'],
        [ZERO_ADDRESS, BALANCE_THRESHOLD, REMOTE_CHAIN_ID]
      );

      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: freeCollectModule.address,
          collectModuleInitData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
          referenceModule: referenceModule.address,
          referenceModuleInitData: referenceModuleInitData,
        })
      ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
    });

    context('context: with valid params', () => {
      let tx;

      beforeEach(async() => {
        const referenceModuleInitData = ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint16'],
          [erc721.address, BALANCE_THRESHOLD, REMOTE_CHAIN_ID]
        );
        tx = await lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: freeCollectModule.address,
          collectModuleInitData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
          referenceModule: referenceModule.address,
          referenceModuleInitData: referenceModuleInitData,
        });
      });

      it('sets storage', async () => {
        const res = await referenceModule.gatedReferencedDataPerPub(FIRST_PROFILE_ID, 1);

        expect(res.balanceThreshold.toNumber()).to.equal(BALANCE_THRESHOLD);
        expect(res.tokenContract).to.equal(erc721.address);
        expect(res.remoteChainId).to.equal(REMOTE_CHAIN_ID);
      });

      it('emits an event', async () => {
        const logs = parseLogsNested(await tx.wait(), abi, LZGatedReferenceModuleABI.abi);
        const event = logs.find(({ name }) => name === 'InitReferenceModule');

        expect(event).not.to.equal(undefined);
        expect(event.args.profileId.toNumber()).to.equal(FIRST_PROFILE_ID);
        expect(event.args.tokenContract).to.equal(erc721.address);
        expect(event.args.chainId).to.equal(REMOTE_CHAIN_ID);
      });
    });
  });

  describe('#processComment (triggered from LZGatedProxy#relayCommentWithSig)', () => {
    let commentWithSigData;
    let referenceModuleInitData;

    beforeEach(async() => {
      const collectModuleInitData = ethers.utils.defaultAbiCoder.encode(['bool'], [true]);
      referenceModuleInitData = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint16'],
        [erc721.address, BALANCE_THRESHOLD, REMOTE_CHAIN_ID]
      );

      await lensHub.post({
        profileId: FIRST_PROFILE_ID,
        contentURI: MOCK_URI,
        collectModule: freeCollectModule.address,
        collectModuleInitData,
        referenceModule: referenceModule.address,
        referenceModuleInitData: referenceModuleInitData,
      });

      const nonce = (await lensHub.sigNonces(userTwoAddress)).toNumber();
      const { v, r, s } = await getCommentWithSigParts(
        userTwo as VoidSigner,
        FIRST_PROFILE_ID + 1,
        OTHER_MOCK_URI,
        FIRST_PROFILE_ID,
        '1',
        [],
        freeCollectModule.address,
        collectModuleInitData,
        ZERO_ADDRESS,
        [],
        nonce,
        MAX_UINT256
      );

      // userTwo signs that they would like to comment on user's first post
      commentWithSigData = {
        profileId: FIRST_PROFILE_ID + 1,
        contentURI: OTHER_MOCK_URI,
        profileIdPointed: FIRST_PROFILE_ID,
        pubIdPointed: '1',
        collectModule: freeCollectModule.address,
        collectModuleInitData,
        referenceModuleData: [],
        referenceModule: ZERO_ADDRESS,
        referenceModuleInitData: [],
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
        lensHub.commentWithSig(commentWithSigData)
      ).to.be.revertedWith('CommentOrMirrorInvalid()');
    });

    it('reverts if the caller does not have suffient balance', async () => {
      await expect(
        lzGatedProxy
          .connect(userTwo)
          .relayCommentWithSig(
            userTwoAddress,
            FIRST_PROFILE_ID + 1,
            FIRST_PROFILE_ID,
            '1',
            erc721.address,
            BALANCE_THRESHOLD,
            commentWithSigData
          )
      ).to.be.revertedWith('InsufficientBalance');
    });

    it('reverts if the contract call for balanceOf() fails', async () => {
      await expect(
        lzGatedProxy
          .connect(userTwo)
          .relayCommentWithSig(
            userAddress,
            FIRST_PROFILE_ID + 1,
            FIRST_PROFILE_ID,
            '1',
            lzEndpoint.address,
            BALANCE_THRESHOLD,
            commentWithSigData
          )
      ).to.be.revertedWith('InsufficientBalance');
    });

    it('[non-blocking] fails if the caller passed an invalid threshold', async () => {
      await erc721.safeMint(userTwoAddress);

      const tx = await lzGatedProxy
        .connect(userTwo)
        .relayCommentWithSig(
          userTwoAddress,
          FIRST_PROFILE_ID + 1,
          FIRST_PROFILE_ID,
          '1',
          erc721.address,
          0,
          commentWithSigData
        );

      const messageFailedReason = getNonBlockingError(await tx.wait());
      expect(messageFailedReason).to.equal('InvalidRemoteInput');
    });


    it('[non-blocking] fails if the caller passed an invalid token contract', async () => {
      await erc20.mint(userTwoAddress, BALANCE_THRESHOLD);

      const tx = await lzGatedProxy
        .connect(userTwo)
        .relayCommentWithSig(
          userTwoAddress,
          FIRST_PROFILE_ID + 1,
          FIRST_PROFILE_ID,
          '1',
          erc20.address,
          BALANCE_THRESHOLD,
          commentWithSigData
        );

      const messageFailedReason = getNonBlockingError(await tx.wait());
      expect(messageFailedReason).to.equal('InvalidRemoteInput');
    });

    it('processes a valid comment', async () => {
      await erc721.safeMint(userTwoAddress);

      const tx = await lzGatedProxy
        .connect(userTwo)
        .relayCommentWithSig(
          userTwoAddress,
          FIRST_PROFILE_ID + 1,
          FIRST_PROFILE_ID,
          '1',
          erc721.address,
          BALANCE_THRESHOLD,
          commentWithSigData
        );
      const logs = parseLogsNested(await tx.wait(), abi, LZGatedReferenceModuleABI.abi);

      const event = logs.find(({ name }) => name === 'MessageFailed');
      const commentEvent = logs.find(({ name }) => name === 'CommentCreated');

      expect(event).to.equal(undefined);
      expect(commentEvent).not.to.equal(undefined);
      expect(commentEvent.args.pubIdPointed.toNumber()).to.equal(1);
      expect(commentEvent.args.profileIdPointed.toNumber()).to.equal(1);
    });
  });

  describe('#processMirror (triggered from LZGatedProxy#relayMirrorWithSig)', () => {
    let mirrorWithSigData;
    let referenceModuleInitData;

    beforeEach(async() => {
      const collectModuleInitData = ethers.utils.defaultAbiCoder.encode(['bool'], [true]);
      referenceModuleInitData = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint16'],
        [erc721.address, BALANCE_THRESHOLD, REMOTE_CHAIN_ID]
      );

      await lensHub.post({
        profileId: FIRST_PROFILE_ID,
        contentURI: MOCK_URI,
        collectModule: freeCollectModule.address,
        collectModuleInitData,
        referenceModule: referenceModule.address,
        referenceModuleInitData: referenceModuleInitData,
      });

      const nonce = (await lensHub.sigNonces(userTwoAddress)).toNumber();
      const { v, r, s } = await getMirrorWithSigParts(
        userTwo as VoidSigner,
        FIRST_PROFILE_ID + 1,
        FIRST_PROFILE_ID,
        '1',
        [],
        ZERO_ADDRESS,
        [],
        nonce,
        MAX_UINT256
      );

      // userTwo signs that they would like to mirror the user's first post
      mirrorWithSigData = {
        profileId: FIRST_PROFILE_ID + 1,
        profileIdPointed: FIRST_PROFILE_ID,
        pubIdPointed: '1',
        referenceModuleData: [],
        referenceModule: ZERO_ADDRESS,
        referenceModuleInitData: [],
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
        lensHub.mirrorWithSig(mirrorWithSigData)
      ).to.be.revertedWith('CommentOrMirrorInvalid()');
    });

    it('reverts if the caller does not have suffient balance', async () => {
      await expect(
        lzGatedProxy
          .connect(userTwo)
          .relayMirrorWithSig(
            userTwoAddress,
            FIRST_PROFILE_ID + 1,
            FIRST_PROFILE_ID,
            '1',
            erc721.address,
            BALANCE_THRESHOLD,
            mirrorWithSigData
          )
      ).to.be.revertedWith('InsufficientBalance');
    });

    it('reverts if the contract call for balanceOf() fails', async () => {
      await expect(
        lzGatedProxy
          .connect(userTwo)
          .relayMirrorWithSig(
            userTwoAddress,
            FIRST_PROFILE_ID + 1,
            FIRST_PROFILE_ID,
            '1',
            lzEndpoint.address,
            BALANCE_THRESHOLD,
            mirrorWithSigData
          )
      ).to.be.revertedWith('InsufficientBalance');
    });

    it('[non-blocking] fails if the caller passed an invalid threshold', async () => {
      await erc721.safeMint(userTwoAddress);

      const tx = await lzGatedProxy
        .connect(userTwo)
        .relayMirrorWithSig(
          userTwoAddress,
          FIRST_PROFILE_ID + 1,
          FIRST_PROFILE_ID,
          '1',
          erc721.address,
          0,
          mirrorWithSigData
        );

      const messageFailedReason = getNonBlockingError(await tx.wait());
      expect(messageFailedReason).to.equal('InvalidRemoteInput');
    });


    it('[non-blocking] fails if the caller passed an invalid token contract', async () => {
      await erc20.mint(userTwoAddress, BALANCE_THRESHOLD);

      const tx = await lzGatedProxy
        .connect(userTwo)
        .relayMirrorWithSig(
          userTwoAddress,
          FIRST_PROFILE_ID + 1,
          FIRST_PROFILE_ID,
          '1',
          erc20.address,
          BALANCE_THRESHOLD,
          mirrorWithSigData
        );

      const messageFailedReason = getNonBlockingError(await tx.wait());
      expect(messageFailedReason).to.equal('InvalidRemoteInput');
    });

    it('processes a valid mirror', async () => {
      await erc721.safeMint(userTwoAddress);

      const tx = await lzGatedProxy
        .connect(userTwo)
        .relayMirrorWithSig(
          userTwoAddress,
          FIRST_PROFILE_ID + 1,
          FIRST_PROFILE_ID,
          '1',
          erc721.address,
          BALANCE_THRESHOLD,
          mirrorWithSigData
        );
      const logs = parseLogsNested(await tx.wait(), abi, LZGatedReferenceModuleABI.abi);

      const event = logs.find(({ name }) => name === 'MessageFailed');
      const commentEvent = logs.find(({ name }) => name === 'MirrorCreated');

      expect(event).to.equal(undefined);
      expect(commentEvent).not.to.equal(undefined);
      expect(commentEvent.args.pubIdPointed.toNumber()).to.equal(1);
      expect(commentEvent.args.profileIdPointed.toNumber()).to.equal(1);
    });
  });
});
