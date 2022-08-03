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
const FIRST_TOKEN_ID = 1;
const FIRST_PROFILE_ID = 1;
const NAME = 'Omni Soulbound Token';
const SYMBOL = 'OMNI-SBT';

describe.only('OmniSBT', () => {
  let omniNFTSource: OmniSBT
  let omniNFTDestination: OmniSBT
  let lzEndpoint: LZEndpointMock

  let deployer: Signer, user: Signer, userTwo: Signer
  let deployerAddress: string, userAddress: string

  before(async() => {
    ([deployer, user, userTwo] = await ethers.getSigners());
    deployerAddress = await deployer.getAddress();
    userAddress = await user.getAddress();
  });

  beforeEach(async () => {
    lzEndpoint = await new LZEndpointMock__factory(deployer).deploy(CHAIN_ID);
    omniNFTDestination = await new OmniSBT__factory(deployer).deploy(lzEndpoint.address, [], []);
    omniNFTSource = await new OmniSBT__factory(deployer).deploy(lzEndpoint.address, [CHAIN_ID], [omniNFTDestination.address]);

    await omniNFTSource.setCollectModule(deployerAddress); // so we can make calls here
  });

  describe('#constructor', () => {
    it('reverts with null address for _lzEndpoint', async() => {
      await expect(
        new OmniSBT__factory(deployer).deploy(ZERO_ADDRESS, [], [])
      ).to.be.revertedWith('NotZeroAddress');
    });

    it('reverts with non-matching array lengths for remoteChainIds/remoteContracts', async() => {
      await expect(
        new OmniSBT__factory(deployer).deploy(lzEndpoint.address, [], [lzEndpoint.address])
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
});
