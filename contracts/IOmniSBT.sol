// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

/**
 * @title IOmniSBT
 */
interface IOmniSBT {
  function createCollection(string memory _uri) external returns (uint256);

  function mint(address collector, uint256 collectionId, uint16 chainId) external payable returns (bool);

  function burn(uint256 tokenId) external;

  function tokenURI(uint256 tokenId) external returns (string memory);

  function lzRemoteLookup(uint16 chainId) external returns (bytes memory);

  function collections() external view returns (uint256);
}
