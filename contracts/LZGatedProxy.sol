// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {DataTypes} from "@aave/lens-protocol/contracts/libraries/DataTypes.sol";
import "./lz/SimpleLzApp.sol";

/**
 * @title LZGatedProxy
 * @notice This contract acts as a proxy for our `LZGated*` Lens modules in order to read
 * token balances from remote contracts on any chain supported by LayerZero.
 */
contract LZGatedProxy is SimpleLzApp {
  error InsufficientBalance();
  error NotAccepting();

  bytes public remoteFollowModule; // LZGatedFollowModule
  bytes public remoteReferenceModule; // LZGatedReferenceModule
  bytes public remoteCollectModule; // LZGatedCollectModule

  /**
   * @dev contract constructor
   * @param _lzEndpoint: The lz endpoint contract deployed on this chain
   * @param _remoteChainId: remote chain id to be set as the trusted remote
   * @param _remoteFollowModule: trusted follow module on the remote chain
   * @param _remoteReferenceModule: trusted reference module on the remote chain
   * @param _remoteCollectModule: trusted collect module on the remote chain
   */
  constructor(
    address _lzEndpoint,
    uint16 _remoteChainId,
    bytes memory _remoteFollowModule,
    bytes memory _remoteReferenceModule,
    bytes memory _remoteCollectModule
  ) SimpleLzApp(_lzEndpoint, msg.sender, _remoteChainId) {
    remoteFollowModule = _remoteFollowModule;
    remoteReferenceModule = _remoteReferenceModule;
    remoteCollectModule = _remoteCollectModule;
  }

  /**
   * @notice validate a token balance on this chain before relaying the intent to follow a Lens profile on the remote
   * chain.
   * NOTE: callers of this function MUST pass the exact values for `tokenContract` and `balanceThreshold` returned from
   * the call to LZGatedFollowModule.gatedFollowPerProfile(profileId) - or the transaction on the remote chain WILL
   * revert.
   * @param follower: the account wishing to perform the follow action
   * @param profileId: the id of the profile being followed
   * @param tokenContract: the ERC20/ERC721 contract set by the `profileId` to check a balance against
   * @param balanceThreshold: the amount of tokens required in order for a successful follow
   * @param followSig: the follow signature expected by the LensHub
   */
  function relayFollowWithSig(
    address follower,
    uint256 profileId,
    address tokenContract,
    uint256 balanceThreshold,
    DataTypes.FollowWithSigData memory followSig
  ) external payable {
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
      bytes("")
    );
  }

  /**
   * @notice validate a token balance on this chain before relaying the intent to comment on a Lens post on the remote
   * chain.
   * NOTE: callers of this function MUST pass the exact values for `tokenContract` and `balanceThreshold` returned from
   * the call to LZGatedReferenceModule.gatedReferenceDataPerPub(profileIdPointed, pubIdPointed) - or the transaction
   * on the remote chain WILL revert.
   * @param sender: the account wishing to perform the comment action
   * @param profileId: the id of the profile wishing to comment
   * @param profileIdPointed: the id of the profile that owns the post
   * @param pubIdPointed: the id of the post
   * @param tokenContract: the ERC20/ERC721 contract set by the `profileId` to check a balance against
   * @param balanceThreshold: the amount of tokens required in order for a successful follow
   * @param commentSig: the comment signature expected by the LensHub
   */
  function relayCommentWithSig(
    address sender,
    uint256 profileId,
    uint256 profileIdPointed,
    uint256 pubIdPointed,
    address tokenContract,
    uint256 balanceThreshold,
    DataTypes.CommentWithSigData memory commentSig
  ) external payable {
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
      bytes("")
    );
  }

  /**
   * @notice validate a token balance on this chain before relaying the intent to mirror a Lens post on the remote
   * chain.
   * NOTE: callers of this function MUST pass the exact values for `tokenContract` and `balanceThreshold` returned from
   * the call to LZGatedReferenceModule.gatedReferenceDataPerPub(profileIdPointed, pubIdPointed) - or the transaction
   * on the remote chain WILL revert.
   * @param sender: the account wishing to perform the mirror action
   * @param profileId: the id of the profile wishing to mirror
   * @param profileIdPointed: the id of the profile that owns the post
   * @param pubIdPointed: the id of the post
   * @param tokenContract: the ERC20/ERC721 contract set by the `profileId` to check a balance against
   * @param balanceThreshold: the amount of tokens required in order for a successful follow
   * @param mirrorSig: the mirror signature expected by the LensHub
   */
  function relayMirrorWithSig(
    address sender,
    uint256 profileId,
    uint256 profileIdPointed,
    uint256 pubIdPointed,
    address tokenContract,
    uint256 balanceThreshold,
    DataTypes.MirrorWithSigData memory mirrorSig
  ) external payable {
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
      bytes("")
    );
  }

  /**
   * @notice validate a token balance on this chain before relaying the intent to collect a Lens post on the remote
   * chain.
   * NOTE: callers of this function MUST pass the exact values for `tokenContract` and `balanceThreshold` returned from
   * the call to LZGatedCollectModule.gatedCollectDataPerPub(profileId, pubId) - or the transaction
   * on the remote chain WILL revert.
   * @param collector: the account wishing to perform the collect action
   * @param profileId: the id of the profile wishing to collect
   * @param pubId: the id of the post
   * @param tokenContract: the ERC20/ERC721 contract set by the `profileId` to check a balance against
   * @param balanceThreshold: the amount of tokens required in order for a successful follow
   * @param collectSig: the collect signature expected by the LensHub
   */
  function relayCollectWithSig(
    address collector,
    uint256 profileId,
    uint256 pubId,
    address tokenContract,
    uint256 balanceThreshold,
    DataTypes.CollectWithSigData memory collectSig
  ) external payable {
    if (!_checkThreshold(collector, tokenContract, balanceThreshold)) { revert InsufficientBalance(); }

    _lzSend(
      remoteCollectModule,
      abi.encode(
        tokenContract,
        collector,
        profileId,
        pubId,
        balanceThreshold,
        collectSig
      ),
      payable(msg.sender),
      bytes("")
    );
  }

  /**
   * @dev not accepting native tokens
   */
  receive() external payable { revert NotAccepting(); }

  /**
   * @dev Check that `account` meets the `balanceThreshold` of held tokens in `tokenContract`; we use the standard
   * `#balanceOf` function signature for ERC721 and ERC20, and simply return false on any error thrown.
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
