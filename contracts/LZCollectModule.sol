// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {ICollectModule} from '@aave/lens-protocol/contracts/interfaces/ICollectModule.sol';
import {ModuleBase, Errors} from "@aave/lens-protocol/contracts/core/modules/ModuleBase.sol";
import {ILensHub} from '@aave/lens-protocol/contracts/interfaces/ILensHub.sol';
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ILZCollectModule} from "./ILZCollectModule.sol";
import "./lz/interfaces/ILayerZeroEndpoint.sol";
import "./IOmniSBT.sol";

/**
 * @title LZCollectModule is a Lens Collect Module that allows creators to mint soulbound NFTs (OmniSBT) for their
 * followers that are cross-chain compatible, via LayerZero.
 * - a creator attaches this module to one of their posts and specifies parameters such as the destination chain id
 * - any user that collects the post gets an OmniSBT minted on the destination chain
 */
contract LZCollectModule is ICollectModule, ILZCollectModule, ModuleBase {
  error NotZeroAddress();
  error InvalidChainId();
  error OnlyFollowers();

  IOmniSBT public omniNFT; // instance of the OmniSBT

  mapping (uint256 => mapping (uint256 => PubCollectData)) public pubCollectData; // profileId => pubID => data

  /**
   * @dev contract constructor
   * @param hub: LensHub
   * @param _omniSBT: whitelisted OmniSBT contract (deployed on same chain as this contract)
   */
  constructor(address hub, address _omniSBT) ModuleBase(hub) {
    if (_omniSBT == address(0) || hub == address(0)) { revert NotZeroAddress(); }

    omniNFT = IOmniSBT(_omniSBT);
  }

  /**
   * @dev Initialize publication collect data for the given `pubId`, including the destination chain to mint the OmniSBT
   * @param profileId: the lens profile
   * @param pubId: the post
   * @param data: encoded data to init this module (followerOnly, chainId)
   */
  function initializePublicationCollectModule(
    uint256 profileId,
    uint256 pubId,
    bytes calldata data
  ) external override onlyHub returns (bytes memory) {
    (bool followerOnly, uint16 chainId) = abi.decode(data, (bool, uint16));

    if (omniNFT.lzRemoteLookup(chainId).length == 0) { revert InvalidChainId(); }

    uint256 collectionId = omniNFT.createCollection(profileId, ILensHub(HUB).getPub(profileId, pubId).contentURI);

    pubCollectData[profileId][pubId].collectionId = collectionId;
    pubCollectData[profileId][pubId].followerOnly = followerOnly;
    pubCollectData[profileId][pubId].chainId = chainId;

    emit InitCollectModule(profileId, pubId, collectionId, chainId, followerOnly);

    return data;
  }

  /**
   * @dev Processes a collect by:
   * - [optional] ensuring the collector is a follower
   * - minting a OmniSBT on the destination chain set
   */
  function processCollect(
    uint256, // referrerProfileId
    address collector,
    uint256 profileId,
    uint256 pubId,
    bytes calldata // data
  ) external override {
    PubCollectData storage collectData = pubCollectData[profileId][pubId];

    if (collectData.followerOnly && !_isFollowing(profileId, collector)) {
      revert OnlyFollowers();
    }

    omniNFT.mint(
      collector,
      collectData.collectionId,
      collectData.chainId
    );
  }

  function _isFollowing(uint256 profileId, address follower) internal view returns (bool) {
    address followNFT = ILensHub(HUB).getFollowNFT(profileId);

    return followNFT != address(0) && IERC721(followNFT).balanceOf(follower) != 0;
  }
}
