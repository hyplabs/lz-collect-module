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
  bytes public remoteFollowModule; // LZGatedFollowModule
  bytes public remoteReferenceModule; // LZGatedReferenceModule
  bytes public remoteCollectModule; // LZGatedCollectModule

  /**
   * @dev contract constructor
   * @param _lzEndpoint: The LZ endpoint contract deployed on this chain
   * @param _remoteChainId: remote chain id to be set as the trusted remote
   * @param _remoteFollowModule: trusted follow module on the remote chain
   * @param _remoteReferenceModule: trusted reference module on the remote chain
   * @param _remoteCollectModule: trusted collect module on the remote chain
   * NOTE: we set `zroPaymentAddress` to the zero address as it does not make sense to make this contract ownable only
   * to set this variable once their token is out, logistics, etc.
   */
  constructor(
    address _lzEndpoint,
    uint16 _remoteChainId,
    bytes memory _remoteFollowModule,
    bytes memory _remoteReferenceModule,
    bytes memory _remoteCollectModule
  ) SimpleLzApp(_lzEndpoint, msg.sender, _remoteChainId) {
    zroPaymentAddress = address(0);

    remoteFollowModule = _remoteFollowModule;
    remoteReferenceModule = _remoteReferenceModule;
    remoteCollectModule = _remoteCollectModule;
  }

  function relayFollowWithSig(
    address follower,
    uint256 profileId,
    address tokenContract,
    uint256 balanceThreshold,
    DataTypes.FollowWithSigData memory followSig
  ) external {
    if (!_checkThreshold(follower, tokenContract, balanceThreshold)) { revert InsufficientBalance(); }

    _lzSend(
      remoteFollowModule,
      abi.encode(
        follower,
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

  function relayCommentWithSig(
    address sender,
    uint256 profileId,
    uint256 profileIdPointed,
    uint256 pubIdPointed,
    address tokenContract,
    uint256 balanceThreshold,
    DataTypes.CommentWithSigData memory commentSig
  ) external {
    if (!_checkThreshold(sender, tokenContract, balanceThreshold)) { revert InsufficientBalance(); }

    _lzSend(
      remoteReferenceModule,
      abi.encode(
        true, // isComment
        tokenContract,
        profileId,
        profileIdPointed,
        pubIdPointed,
        balanceThreshold,
        commentSig
      ),
      payable(msg.sender),
      zroPaymentAddress,
      bytes("")
    );
  }

  function relayMirrorWithSig(
    address sender,
    uint256 profileId,
    uint256 profileIdPointed,
    uint256 pubIdPointed,
    address tokenContract,
    uint256 balanceThreshold,
    DataTypes.MirrorWithSigData memory mirrorSig
  ) external {
    if (!_checkThreshold(sender, tokenContract, balanceThreshold)) { revert InsufficientBalance(); }

    _lzSend(
      remoteReferenceModule,
      abi.encode(
        false, // isComment
        tokenContract,
        profileId,
        profileIdPointed,
        pubIdPointed,
        balanceThreshold,
        mirrorSig
      ),
      payable(msg.sender),
      zroPaymentAddress,
      bytes("")
    );
  }

  // @TODO
  // function relayCollectWithSig(
  //   address collector,
  //   uint256 profileId,
  //   uint256 pubId,
  //   address tokenContract,
  //   uint256 balanceThreshold,
  //   DataTypes.CollectWithSigData memory collectSig
  // ) external {
  //   if (!_checkThreshold(collector, tokenContract, balanceThreshold)) { revert InsufficientBalance(); }
  //
  //   _lzSend(
  //     remoteCollectModule,
  //     abi.encode(
  //       tokenContract,
  //       collector,
  //       profileId,
  //       pubId,
  //       balanceThreshold,
  //       collectSig
  //     ),
  //     payable(msg.sender),
  //     zroPaymentAddress,
  //     bytes("")
  //   );
  // }

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
