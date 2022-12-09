import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Signer } from 'ethers';
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
} from './lens/__setup.spec';
import { ERRORS } from './lens/helpers/errors';
import { ZERO_ADDRESS } from './lens/helpers/constants';
import {
  LZCollectModule,
  LZCollectModule__factory,
  OmniSBT,
  OmniSBT__factory,
  LZEndpointMock,
  LZEndpointMock__factory,
} from '../typechain-types'
import { abi } from './lens/abi/Events.json';
import LZCollectModuleABI from './../build/contracts/LZCollectModule.sol/LZCollectModule.json';
import { parseLogsNested } from './utils/parseLogs';

const EMPTY_BYTES = '0x';
const FIRST_PUB_ID = 1;
const FIRST_COLLECTION_ID = 1;
const CHAIN_ID = 123;

makeSuiteCleanRoom('LZCollectModule', function () {
  let omniNFTSource: OmniSBT, omniNFTDestination: OmniSBT;
  let lzEndpoint: LZEndpointMock
  let collectModule: LZCollectModule;
  let deployer: Signer, user: Signer, userTwo: Signer, userThree: Signer;
  let deployerAddress: string, userAddress: string, userTwoAddress: string;

  beforeEach(async () => {
    ([deployer, user, userTwo, userThree] = await ethers.getSigners());
    deployerAddress = await deployer.getAddress();
    userAddress = await user.getAddress();
    userTwoAddress = await userTwo.getAddress();

    lzEndpoint = await new LZEndpointMock__factory(deployer).deploy(CHAIN_ID);
    omniNFTDestination = await new OmniSBT__factory(deployer).deploy(lzEndpoint.address, [], [], false);
    omniNFTSource = await new OmniSBT__factory(deployer).deploy(
      lzEndpoint.address,
      [CHAIN_ID],
      [omniNFTDestination.address],
      true // isSource
    );
    collectModule = await new LZCollectModule__factory(deployer).deploy(lensHub.address, omniNFTSource.address);

    await omniNFTSource.setCollectModule(collectModule.address);
    await omniNFTDestination.setTrustedRemote(CHAIN_ID, omniNFTSource.address);

    // use same lz endpoint mock
    await lzEndpoint.setDestLzEndpoint(omniNFTSource.address, lzEndpoint.address);
    await lzEndpoint.setDestLzEndpoint(omniNFTDestination.address, lzEndpoint.address);

    await lensHub.connect(governance).whitelistCollectModule(collectModule.address, true);

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
    it('reverts when the _omniSBT arg is the null address', async () => {
      expect(
        new LZCollectModule__factory(deployer).deploy(lensHub.address, ZERO_ADDRESS)
      ).to.be.revertedWith('InitParamsInvalid');
    });

    it('reverts when the hub arg is the null address', async () => {
      expect(
        new LZCollectModule__factory(deployer).deploy(ZERO_ADDRESS, omniNFTSource.address)
      ).to.be.revertedWith('InitParamsInvalid');
    });

    it('sets storage', async () => {
      const res = await collectModule.omniNFT();
      expect(res).to.equal(omniNFTSource.address);
    })
  });

  describe('#initializePublicationCollectModule', () => {
    it('reverts when the caller is not LensHub', async () => {
      await expect(
        collectModule.initializePublicationCollectModule(FIRST_PROFILE_ID, 1, EMPTY_BYTES)
      ).to.be.revertedWith(ERRORS.NOT_HUB);
    });

    it('reverts when an invalid chain id is provided in the encoded data', async () => {
      const collectModuleInitData = ethers.utils.defaultAbiCoder.encode(['bool', 'uint16'], [false, 40]);

      await expect(
        lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: collectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.be.revertedWith('InvalidChainId');
    });

    context('context: with valid params', () => {
      let tx;

      beforeEach(async() => {
        const collectModuleInitData = ethers.utils.defaultAbiCoder.encode(['bool', 'uint16'], [false, CHAIN_ID]);
        tx = await lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: collectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        });
      });

      it('sets storage', async () => {
        const res = await collectModule.pubCollectData(FIRST_PROFILE_ID, FIRST_PUB_ID);

        expect(res.collectionId.toNumber()).to.equal(FIRST_COLLECTION_ID);
        expect(res.followerOnly).to.equal(false);
        expect(res.chainId).to.equal(CHAIN_ID);
      });

      it('emits an event', async () => {
        const logs = parseLogsNested(await tx.wait(), abi, LZCollectModuleABI.abi);
        const event = logs.find(({ name }) => name === 'InitCollectModule');
        expect(event).not.to.equal(undefined);
        expect(event.args.collectionId.toNumber()).to.equal(FIRST_COLLECTION_ID);
        expect(event.args.destinationChainId).to.equal(CHAIN_ID);
      });
    });
  });

  describe('#processCollect', () => {
    context('context: when followerOnly is set to true', () => {
      beforeEach(async() => {
        const collectModuleInitData = ethers.utils.defaultAbiCoder.encode(['bool', 'uint16'], [true, CHAIN_ID]);
        await lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: collectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        });
      });

      it('reverts when the collector is not following the profile', async () => {
        await expect(
          lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, FIRST_PUB_ID, [])
        ).to.be.revertedWith('OnlyFollowers');
      });

      it('mints an NFT for the follower/collector on the destination chain', async () => {
        await lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [[]]);
        await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, FIRST_PUB_ID, []);
        const balanceDest = await omniNFTDestination.balanceOf(userTwoAddress);
        expect(balanceDest.toNumber()).to.equal(1);
      });
    });

    context('context: when followerOnly is set to false', () => {
      it('mints an NFT for the collector (non-follower) on the destination chain', async () => {
        const collectModuleInitData = ethers.utils.defaultAbiCoder.encode(['bool', 'uint16'], [false, CHAIN_ID]);
        await lensHub.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          collectModule: collectModule.address,
          collectModuleInitData: collectModuleInitData,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        });

        await lensHub.connect(userTwo).collect(FIRST_PROFILE_ID, FIRST_PUB_ID, []);
        const balanceDest = await omniNFTDestination.balanceOf(userTwoAddress);
        expect(balanceDest.toNumber()).to.equal(1);
      });
    });
  });
});
