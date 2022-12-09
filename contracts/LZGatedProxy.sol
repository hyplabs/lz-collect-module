// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {DataTypes} from "@aave/lens-protocol/contracts/libraries/DataTypes.sol";
import "./lz/SimpleLzApp.sol";

/**
 * @title LZGatedProxy
 * @notice This contract acts as a proxy for `LZGatedFollowModule` and `LZGatedReference` in order to read
 * token balances from remote contracts on any chain supported by layerzero.
 */
contract LZGatedProxy is SimpleLzApp {
  error InsufficientBalance();

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

  function validateAndRelayWithSig(
    uint256 profileId,
    address tokenContract,
    uint256 balanceThreshold,
    DataTypes.FollowWithSigData memory followSig
  ) external {
    if (!_checkThreshold(msg.sender, tokenContract, balanceThreshold)) { revert InsufficientBalance(); }

    _lzSend(
      abi.encode(
        msg.sender,
        tokenContract,
        profileId,
        balanceThreshold,
        followSig
      ),
      payable(msg.sender),
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
    ) = tokenContract.call(abi.encodeWithSignature("balanceOf(address)", account));

    if (!success) return false;

    (uint256 balance) = abi.decode(result, (uint256));

    return balance >= balanceThreshold;
  }
}
