// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/**
 * @title IOmniSBT
 */
interface IOmniSBT {
  function createCollection(uint256 profileId, string memory _uri) external returns (uint256);

  function mint(address collector, uint256 collectionId, uint16 chainId) external returns (bool);

  function burn(uint256 tokenId) external;

  function tokenURI(uint256 tokenId) external returns (string memory);

  function lzRemoteLookup(uint16 chainId) external returns (bytes memory);
}
