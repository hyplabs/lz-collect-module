// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/**
 * @title ILZCollectModule
 */
interface ILZCollectModule {
  struct PubCollectData {
    uint256 collectionId;
    uint16 chainId;
    bool followerOnly;
  }

  event InitCollectModule(
    uint256 profileId,
    uint256 pubId,
    uint256 collectionId,
    uint16 destinationChainId,
    bool followerOnly
  );
}
