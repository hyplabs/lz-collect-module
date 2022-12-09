// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {IReferenceModule} from '@aave/lens-protocol/contracts/interfaces/IReferenceModule.sol';
import {ModuleBase, Errors} from "@aave/lens-protocol/contracts/core/modules/ModuleBase.sol";
import {FollowValidationModuleBase} from '@aave/lens-protocol/contracts/core/modules/FollowValidationModuleBase.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import {ILensHub} from "@aave/lens-protocol/contracts/interfaces/ILensHub.sol";
import {DataTypes} from "@aave/lens-protocol/contracts/libraries/DataTypes.sol";
import {LzApp} from "./lz/LzApp.sol";
import "hardhat/console.sol";

/**
 * @title LZGatedReferenceModule
 * @author Hypotenuse Labs
 *
 * @notice A Lens Reference Module that allows publication creators to gate who can mirror their post with ERC20 or
 * ERC721 balances held on other chains.
 */
contract LZGatedReferenceModule is FollowValidationModuleBase, IReferenceModule, LzApp {
  address public zroPaymentAddress; // ZRO payment address

  struct GatedReferenceData {
    address remoteContract; // the remote contract to read from
    uint256 balanceThreshold; // result of balanceOf() should be greater than or equal to
    uint16 remoteChainId; // the remote chainId to read against
  }

  mapping (uint256 => mapping (uint256 => GatedReferenceData)) public gatedReferencedDataPerPub; // profileId => pubId => gated reference data
  mapping (uint256 => mapping (uint256 => mapping (uint256 => bool))) public validatedReferencers; // profileIdPointed => pubId => profiles which have been validated

  event InitReferenceModule(uint256 indexed profileId, address tokenContract, uint256 balanceThreshold, uint16 chainId);
  event MessageFailed(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes _payload, string _reason);

  error CommentOrMirrorInvalid();

  /**
   * @dev contract constructor
   * @param hub LensHub
   * @param _lzEndpoint: LayerZero endpoint on this chain to relay messages
   * @param remoteChainIds: whitelisted destination chain ids (supported by LayerZero)
   * @param remoteProxies: proxy destination contracts (deployed by us)
   * NOTE: we set `zroPaymentAddress` to the zero address as it does not make sense to make this module ownable only to
   * set this variable once their token is out, logistics, etc.
   */
  constructor(
    address hub,
    address _lzEndpoint,
    uint16[] memory remoteChainIds,
    bytes[] memory remoteProxies
  ) ModuleBase(hub) LzApp(_lzEndpoint, msg.sender, remoteChainIds, remoteProxies) {
    zroPaymentAddress = address(0);
  }

  /**
   * @notice Initialize this reference module for the given profile/publication
   *
   * @param profileId The profile ID of the profile creating the pub
   * @param pubId The pub to init this reference module to
   * @param data The arbitrary data parameter, which in this particular module initialization will be just ignored.
   *
   * @return bytes Empty bytes.
   */
  function initializeReferenceModule(uint256 profileId, uint256 pubId, bytes calldata data)
    external
    override
    onlyHub
    returns (bytes memory)
  {
    (
      address tokenContract,
      uint256 balanceThreshold,
      uint16 chainId
    ) = abi.decode(data, (address, uint256, uint16));

    if (address(tokenContract) == address(0) || _lzRemoteLookup[chainId].length == 0) {
      revert Errors.InitParamsInvalid();
    }

    gatedReferencedDataPerPub[profileId][pubId] = GatedReferenceData({
      remoteChainId: chainId,
      remoteContract: tokenContract,
      balanceThreshold: balanceThreshold
    });

    emit InitReferenceModule(profileId, tokenContract, balanceThreshold, chainId);

    return new bytes(0);
  }

  /**
   * @dev Process a comment by:
   * - checking that we have already validated the commentor through our `LZGatedProxy` on a remote chain
   */
  function processComment(
    uint256 profileId,
    uint256 profileIdPointed,
    uint256 pubIdPointed,
    bytes calldata // data
  ) external view override onlyHub {
    if (!validatedReferencers[profileIdPointed][pubIdPointed][profileId]) {
      revert CommentOrMirrorInvalid();
    }
  }

  /**
   * @dev Process a mirror by:
   * - checking that we have already validated the mirrorer through our `LZGatedProxy` on a remote chain
   */
  function processMirror(
    uint256 profileId,
    uint256 profileIdPointed,
    uint256 pubIdPointed,
    bytes calldata // data
  ) external view override onlyHub {
    if (!validatedReferencers[profileIdPointed][pubIdPointed][profileId]) {
      revert CommentOrMirrorInvalid();
    }
  }

  /**
   * @dev Callback from our `LZGatedProxy` contract deployed on a remote chain, signals that the comment/mirror
   * is validated
   * NOTE: this function is actually non-blocking in that it catches errors thrown from LensHub
   */
  function _blockingLzReceive(
    uint16 _srcChainId,
    bytes memory _srcAddress,
    uint64 _nonce,
    bytes memory _payload
  ) internal override {
    (
      bool isComment,
      address token,
      uint256 profileId,
      uint256 profileIdPointed,
      uint256 pubIdPointed,
      uint256 threshold,
    ) = abi.decode(_payload, (bool, address, uint256, uint256, uint256, uint256, bytes));

    GatedReferenceData memory data = gatedReferencedDataPerPub[profileIdPointed][pubIdPointed];

    if (data.remoteChainId != _srcChainId || data.balanceThreshold != threshold || data.remoteContract != token) {
      emit MessageFailed(_srcChainId, _srcAddress, _nonce, _payload, 'InvalidRemoteInput');
      return;
    }

    // @TODO: hash the vars vs deeply nested?
    validatedReferencers[profileIdPointed][pubIdPointed][profileId] = true;

    string memory error = isComment ? _handleComment(_payload) : _handleMirror(_payload);

    delete validatedReferencers[profileIdPointed][pubIdPointed][profileId];

    if (bytes(error).length > 0) {
      emit MessageFailed(_srcChainId, _srcAddress, _nonce, _payload, error);
    }
  }

  /**
   * @dev Decodes the `payload` for Lens#commentWithSig
   * @return an error string if the call failed, else empty string
   */
  function _handleComment(bytes memory _payload) internal returns (string memory) {
    (,,,,,,DataTypes.CommentWithSigData memory commentSig) = abi.decode(
      _payload,
      (bool, address, uint256, uint256, uint256, uint256, DataTypes.CommentWithSigData)
    );

    try ILensHub(HUB).commentWithSig(commentSig) {
      return "";
    } catch Error (string memory reason) {
      return reason;
    }
  }

  /**
   * @dev Decodes the `payload` for Lens#mirrorWithSig
   * @return an error string if the call failed, else empty string
   */
  function _handleMirror(bytes memory _payload) internal returns (string memory) {
    (,,,,,,DataTypes.MirrorWithSigData memory mirrorSig) = abi.decode(
      _payload,
      (bool, address, uint256, uint256, uint256, uint256, DataTypes.MirrorWithSigData)
    );

    try ILensHub(HUB).mirrorWithSig(mirrorSig) {
      return "";
    } catch Error (string memory reason) {
      return reason;
    }
  }
}
