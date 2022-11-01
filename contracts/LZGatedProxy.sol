// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./lz/SimpleLzApp.sol";
import "./utils/ExcessivelySafeCall.sol";

/**
 * @title LZGatedProxy
 * @notice This contract acts as a proxy for `LZGatedFollowModule` and `LZGatedReference` in order to read
 * token balances from remote contracts on any chain supported by layerzero.
 */
contract LZGatedProxy is SimpleLzApp {
  using ExcessivelySafeCall for address;

  address public zroPaymentAddress; // ZRO payment address

  /**
   * @dev contract constructor
   * @param _lzEndpoint: The LZ endpoint contract deployed on this chain
   * @param _remoteChainId: remote chain id to be set as the trusted remote
   * @param _remoteContract: remote contract to be set as the trusted remote
   * NOTE: we set `zroPaymentAddress` to the zero address as it does not make sense to make this contract ownable only
   * to set this variable once their token is out, logistics, etc.
   */
  constructor(
    address _lzEndpoint,
    uint16 _remoteChainId,
    bytes memory _remoteContract
  ) SimpleLzApp(_lzEndpoint, msg.sender, _remoteChainId, _remoteContract) {
    zroPaymentAddress = address(0);
  }

  /**
   * @dev receiving a request from the remote module to validate the token balance for a given account on a given
   * token contract. The result is then sent back to the remote contract.
   */
  function _blockingLzReceive(
    uint16, // _srcChainId
    bytes memory, // _srcAddress
    uint64, // _nonce
    bytes memory _payload
  ) internal override {
    (
      address follower,
      address tokenContract,
      uint256 profileId,
      uint256 balanceThreshold
    ) = abi.decode(_payload, (address, address, uint256, uint256));

    _lzSend(
      abi.encode(follower, profileId, _checkThreshold(follower, tokenContract, balanceThreshold)),
      payable(follower),
      zroPaymentAddress,
      bytes("")
    );
  }

  /**
   * @dev Check that `account` meets the threshold of held tokens in `tokenContract`; we use the standard `#balanceOf`
   * function signature for ERC721 and ERC20
   */
  function _checkThreshold(address account, address tokenContract, uint256 balanceThreshold) private returns (bool) {
    (
      bool success,
      bytes memory result
    ) = tokenContract.excessivelySafeCall(
      gasleft(),
      150,
      abi.encodeWithSignature("balanceOf(address)", account)
    );

    if (!success) return false;

    (uint256 balance) = abi.decode(result, (uint256));

    return balance >= balanceThreshold;
  }
}
