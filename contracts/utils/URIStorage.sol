// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @dev storage based token URI management.
 */
abstract contract URIStorage {
  mapping(uint256 => string) private _tokenURIs;

  function tokenURI(uint256 tokenId) public view virtual returns (string memory) {
    return _tokenURIs[tokenId];
  }

  /**
   * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
   */
  function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
    _tokenURIs[tokenId] = _tokenURI;
  }
}
