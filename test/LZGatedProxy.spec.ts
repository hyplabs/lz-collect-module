import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Signer, utils } from 'ethers';
const { getContractAddress } = require('@ethersproject/address');
import { ethers } from 'hardhat';
import { ZERO_ADDRESS } from './lens/helpers/constants';
import {
  LZGatedFollowModule,
  LZGatedFollowModule__factory,
  LZGatedReferenceModule,
  LZGatedReferenceModule__factory,
  LZGatedProxy,
  LZGatedProxy__factory,
  LZEndpointMock,
  LZEndpointMock__factory,
} from '../typechain-types'

const REMOTE_CHAIN_ID = 123;
const CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION = 1;

describe('LZGatedProxy', () => {
  let lzGatedProxy: LZGatedProxy;
  let lzEndpoint: LZEndpointMock;
  let followModule: LZGatedFollowModule;
  let referenceModule: LZGatedReferenceModule;
  let deployer: Signer, user: Signer, userTwo: Signer, userThree: Signer;
  let deployerAddress: string, userAddress: string, userTwoAddress: string;

  beforeEach(async () => {
    ([deployer, user, userTwo, userThree] = await ethers.getSigners());
    deployerAddress = await deployer.getAddress();
    userAddress = await user.getAddress();
    userTwoAddress = await userTwo.getAddress();

    lzEndpoint = await new LZEndpointMock__factory(deployer).deploy(REMOTE_CHAIN_ID);
    const transactionCount = await deployer.getTransactionCount();
    const followModuleAddress = getContractAddress({ from: deployerAddress, nonce: transactionCount + 1 });
    const referenceModuleAddress = getContractAddress({ from: deployerAddress, nonce: transactionCount + 2 });

    lzGatedProxy = await new LZGatedProxy__factory(deployer).deploy(
      lzEndpoint.address,
      REMOTE_CHAIN_ID,
      followModuleAddress,
      referenceModuleAddress, // _remoteReferenceModule
      ZERO_ADDRESS // _remoteCollectModule
    );
    followModule = await new LZGatedFollowModule__factory(deployer).deploy(
      lzGatedProxy.address, // lensHub does not matter
      lzEndpoint.address,
      [REMOTE_CHAIN_ID],
      [lzGatedProxy.address]
    );
    referenceModule = await new LZGatedReferenceModule__factory(deployer).deploy(
      lzGatedProxy.address, // lensHub does not matter
      lzEndpoint.address,
      [REMOTE_CHAIN_ID],
      [lzGatedProxy.address]
    );

    // use same lz endpoint mock
    await lzEndpoint.setDestLzEndpoint(referenceModule.address, lzEndpoint.address);
    await lzEndpoint.setDestLzEndpoint(followModule.address, lzEndpoint.address);
    await lzEndpoint.setDestLzEndpoint(lzGatedProxy.address, lzEndpoint.address);
  });

  describe('#constructor', () => {
    it('reverts when the _lzEndpoint arg is the null address', async () => {
      expect(
        new LZGatedProxy__factory(deployer).deploy(
          ZERO_ADDRESS,
          REMOTE_CHAIN_ID,
          followModule.address,
          referenceModule.address,
          ZERO_ADDRESS
        )
      ).to.be.revertedWith('NotZeroAddress');
    });

    it('sets storage', async () => {
      const owner = await lzGatedProxy.owner();
      const endpoint = await lzGatedProxy.lzEndpoint();
      const followModuleAddress = await lzGatedProxy.remoteFollowModule();
      const remoteReferenceModule = await lzGatedProxy.remoteReferenceModule();

      expect(owner).to.equal(deployerAddress);
      expect(endpoint).to.equal(lzEndpoint.address);
      expect(utils.getAddress(followModuleAddress)).to.equal(followModule.address);
      expect(utils.getAddress(remoteReferenceModule)).to.equal(referenceModule.address);
    });
  });

  describe.skip('#relayFollowWithSig (part of LZGatedFollowModule.spec.ts)', () => {});

  describe.skip('#relayCommentWithSig (part of LZGatedReferenceModule.spec.ts)', () => {});

  describe.skip('#relayMirrorWithSig (part of LZGatedReferenceModule.spec.ts)', () => {});
});
