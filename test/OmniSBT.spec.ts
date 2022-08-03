import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
  OmniSBT,
  OmniSBT__factory,
  LZEndpointMock,
  LZEndpointMock__factory,
} from '../typechain-types'
import { abi } from './../build/contracts/OmniSBT.sol/OmniSBT.json';
import parseLogs from './utils/parseLogs';
import { ZERO_ADDRESS } from './lens/helpers/constants';

const CHAIN_ID = 123;
const FIRST_PROFILE_ID = 1;
const FIRST_COLLECTION_ID = 1;
const FIRST_COLLECTION_URI = 'ipfs://';
const NAME = 'Omni Soulbound Token';
const SYMBOL = 'OMNI-SBT';

describe('OmniSBT', () => {
  let omniNFTSource: OmniSBT
  let omniNFTDestination: OmniSBT
  let lzEndpoint: LZEndpointMock

  let deployer: Signer, user: Signer, userTwo: Signer
  let deployerAddress: string, userAddress: string

  beforeEach(async() => {
    ([deployer, user, userTwo] = await ethers.getSigners());
    deployerAddress = await deployer.getAddress();
    userAddress = await user.getAddress();

    lzEndpoint = await new LZEndpointMock__factory(deployer).deploy(CHAIN_ID);
    omniNFTDestination = await new OmniSBT__factory(deployer).deploy(lzEndpoint.address, [], [], false);
    omniNFTSource = await new OmniSBT__factory(deployer).deploy(
      lzEndpoint.address,
      [CHAIN_ID],
      [omniNFTDestination.address],
      true // isSource
    );

    await omniNFTSource.setCollectModule(deployerAddress); // so we can make permissioned calls

    // use same lz endpoint mock
    await lzEndpoint.setDestLzEndpoint(omniNFTSource.address, lzEndpoint.address);
    await lzEndpoint.setDestLzEndpoint(omniNFTDestination.address, lzEndpoint.address);
  });

  describe('#constructor', () => {
    it('reverts with null address for _lzEndpoint', async() => {
      await expect(
        new OmniSBT__factory(deployer).deploy(ZERO_ADDRESS, [], [], false)
      ).to.be.revertedWith('NotZeroAddress');
    });

    it('reverts with non-matching array lengths for remoteChainIds/remoteContracts', async() => {
      await expect(
        new OmniSBT__factory(deployer).deploy(lzEndpoint.address, [], [lzEndpoint.address], false)
      ).to.be.revertedWith('ArrayMismatch');
    });

    it('sets storage data', async() => {
      const name = await omniNFTSource.name();
      const symbol = await omniNFTSource.symbol();
      const zroPaymentAddress = await omniNFTSource.zroPaymentAddress();
      const remoteSource = await omniNFTSource.lzRemoteLookup(CHAIN_ID);

      expect(name).to.equal(NAME);
      expect(symbol).to.equal(SYMBOL);
      expect(zroPaymentAddress).to.equal(ZERO_ADDRESS);
      expect(ethers.utils.getAddress(remoteSource)).to.equal(omniNFTDestination.address);
    });
  });

  describe('#createCollection', () => {
    it('reverts if the caller is not the collect module', async () => {
      await expect(
        omniNFTSource.connect(user).createCollection(FIRST_PROFILE_ID, FIRST_COLLECTION_URI)
      ).to.be.revertedWith('OnlyCollectModule');
    });

    it('increments the collections counter', async () => {
      await omniNFTSource.createCollection(FIRST_PROFILE_ID, FIRST_COLLECTION_URI);

      const res = await omniNFTSource.collections();
      expect(res.toNumber()).to.equal(FIRST_COLLECTION_ID);
    });
  });

  describe('#mint', () => {
    beforeEach(async () => {
      await omniNFTSource.createCollection(FIRST_PROFILE_ID, FIRST_COLLECTION_URI);
    });

    it('reverts if the caller is not the collect module', async () => {
      await expect(
        omniNFTSource.connect(user).mint(userAddress, FIRST_COLLECTION_ID, CHAIN_ID)
      ).to.be.revertedWith('OnlyCollectModule');
    });

    it('reverts if chain id is not registered as a remote source', async () => {
      await expect(
        omniNFTSource.mint(userAddress, FIRST_COLLECTION_ID, 404)
      ).to.be.revertedWith('RemoteNotFound');
    });

    it('reverts if the source contract is not set as a trusted remote', async () => {
      await expect(
        omniNFTSource.mint(userAddress, FIRST_COLLECTION_ID, CHAIN_ID)
      ).to.be.revertedWith('OnlyTrustedRemote');
    });

    it('only mints the token on the destination chain', async () => {
      await omniNFTDestination.setTrustedRemote(CHAIN_ID, omniNFTSource.address);
      await omniNFTSource.mint(userAddress, FIRST_COLLECTION_ID, CHAIN_ID);

      const balanceSource = await omniNFTSource.balanceOf(userAddress);
      const balanceDest = await omniNFTDestination.balanceOf(userAddress);
      const uriSource = await omniNFTSource.tokenURI(1);
      const uriDest = await omniNFTDestination.tokenURI(1);

      expect(balanceSource.toNumber()).to.equal(0);
      expect(balanceDest.toNumber()).to.equal(1);
      expect(uriSource).to.equal('');
      expect(uriDest).to.equal(FIRST_COLLECTION_URI);
    });
  });

  describe('#burn', () => {
    beforeEach(async () => {
      await omniNFTSource.createCollection(FIRST_PROFILE_ID, FIRST_COLLECTION_URI);
      await omniNFTDestination.setTrustedRemote(CHAIN_ID, omniNFTSource.address);
      await omniNFTSource.mint(userAddress, FIRST_COLLECTION_ID, CHAIN_ID);
    });

    it('reverts if calling on the source contract', async () => {
      await expect(
        omniNFTSource.connect(user).burn(1)
      ).to.be.revertedWith('OnlyTokenOwner');
    });

    it('reverts if the caller has no balance', async () => {
      await expect(
        omniNFTDestination.burn(1)
      ).to.be.revertedWith('OnlyTokenOwner');
    });

    it('burns the token on the destination chain', async () => {
      await omniNFTDestination.connect(user).burn(1)
      const balance = await omniNFTDestination.balanceOf(userAddress);
      const uri = await omniNFTDestination.tokenURI(1);

      expect(balance.toNumber()).to.equal(0);
      expect(uri).to.equal('');
    });
  });

  describe('#setCollectModule', () => {
    it('reverts if the caller is not the contract owner', async () => {
      await expect(
        omniNFTSource.connect(user).setCollectModule(userAddress)
      ).to.be.revertedWith('UNAUTHORIZED');
    });

    it('sets storage', async () => {
      await omniNFTSource.setCollectModule(userAddress);

      const res = await omniNFTSource.collectModule();
      expect(res).to.equal(userAddress);
    });
  });

  describe('#setZroPaymentAddress', () => {
    it('reverts if the caller is not the contract owner', async () => {
      await expect(
        omniNFTSource.connect(user).setZroPaymentAddress(userAddress)
      ).to.be.revertedWith('UNAUTHORIZED');
    });

    it('sets storage', async () => {
      await omniNFTSource.setZroPaymentAddress(userAddress);

      const res = await omniNFTSource.zroPaymentAddress();
      expect(res).to.equal(userAddress);
    });
  });

  describe('#supportsInterface', () => {
    const iER721 = '0x5b5e139f';

    context('context: on the source chain', () => {
      it('returns false for ERC721Metadata', async () => {
        const res = await omniNFTSource.supportsInterface(iER721);
        expect(res).to.equal(false);
      });
    });

    context('context: on the destination chain', () => {
      it('returns true for ERC721Metadata', async () => {
        const res = await omniNFTDestination.supportsInterface(iER721);
        expect(res).to.equal(true);
      });
    });
  });
});
