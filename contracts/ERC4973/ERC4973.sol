// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import "./IERC4973.sol";

abstract contract ERC4973 is IERC4973 {
  string public name;
  string public symbol;

  mapping(uint256 => address) internal _ownerOf;
  mapping(address => uint256) internal _balanceOf;

  constructor(string memory _name, string memory _symbol) {
    name = _name;
    symbol = _symbol;
  }

  function ownerOf(uint256 tokenId) external view virtual returns (address owner) {
    require((owner = _ownerOf[tokenId]) != address(0), "NOT_MINTED");
  }

  function balanceOf(address owner) external view virtual returns (uint256) {
    require(owner != address(0), "ZERO_ADDRESS");

    return _balanceOf[owner];
  }

  function burn(uint256 tokenId) external virtual {
    require(_ownerOf[tokenId] == msg.sender, "INVALID_OWNER");

    _burn(tokenId);
  }

  function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
    return
      interfaceId == 0x01ffc9a7 || // ERC165 Interface ID for ERC165
      interfaceId == 0x5b5e139f; // ERC165 Interface ID for ERC721Metadata
  }

  function _mint(address to, uint256 id) internal virtual {
    require(to != address(0), "INVALID_RECIPIENT");
    require(_ownerOf[id] == address(0), "ALREADY_MINTED");

    // Counter overflow is incredibly unrealistic.
    unchecked {
      _balanceOf[to]++;
    }

    _ownerOf[id] = to;

    emit Attest(to, id);
  }

  function _burn(uint256 id) internal virtual {
    address owner = _ownerOf[id];

    require(owner != address(0), "NOT_MINTED");

    // Ownership check above ensures no underflow.
    unchecked {
      _balanceOf[owner]--;
    }

    delete _ownerOf[id];

    emit Revoke(address(0), id);
  }
}
