// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {ModuleBase, Errors} from "@aave/lens-protocol/contracts/core/modules/ModuleBase.sol";
import {FollowValidatorFollowModuleBase} from "@aave/lens-protocol/contracts/core/modules/follow/FollowValidatorFollowModuleBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {NonblockingFlexLzApp} from "./lz/NonblockingFlexLzApp.sol";

/**
 * @title LZGatedFollowModule
 * @author Hypotenuse Labs
 *
 * @notice A Lens Follow Module that allows profile holders to gate their following with ERC20 or ERC721 balances held
 * on other chains.
 */
contract LZGatedFollowModule is FollowValidatorFollowModuleBase, NonblockingFlexLzApp {
  address public zroPaymentAddress; // ZRO payment address
  uint16 public sourceChainId; // chainId (lz) this module is deployed on

  struct GatedFollowData {
    address remoteContract; // the remote contract to read from
    uint256 balanceThreshold; // result of balanceOf() should be greater than or equal to
    uint16 remoteChainId; // the remote chainId to read against
  }

  mapping (uint256 => GatedFollowData) public gatedFollowPerProfile; // profileId => gated follow data

  event InitFollowModule(uint256 indexed profileId, address tokenContract, uint256 balanceThreshold, uint16 chainId);

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
    uint16 _sourceChainId,
    bytes[] memory remoteProxies
  ) ModuleBase(hub) NonblockingFlexLzApp(_lzEndpoint, msg.sender, remoteChainIds, remoteProxies) {
    zroPaymentAddress = address(0);
    sourceChainId = _sourceChainId;
  }

  /**
   * @notice Initialize this follow module for the given profile
   *
   * @param profileId The profile ID of the profile to initialize this module for.
   * @param data The arbitrary data parameter, which in this particular module initialization will be just ignored.
   *
   * @return bytes Empty bytes.
   */
  function initializeFollowModule(uint256 profileId, bytes calldata data)
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

    if (address(tokenContract) == address(0) || (chainId != sourceChainId && _lzRemoteLookup[chainId].length == 0)) {
      revert Errors.InitParamsInvalid();
    }

    gatedFollowPerProfile[profileId] = GatedFollowData({
      remoteChainId: chainId,
      remoteContract: tokenContract,
      balanceThreshold: balanceThreshold
    });

    emit InitFollowModule(profileId, tokenContract, balanceThreshold, chainId);

    return new bytes(0);
  }

  /**
   * @dev Process a follow by:
   * - revert if the `follower` is already following the profile
   * - if the profile has set gated follow data on this chain, just do the token balance check inline
   * - else send the payload for one of our cross-chain proxies to do the check for us and return the result async
   */
  function processFollow(
    address follower,
    uint256 profileId,
    bytes calldata // data
  ) external override onlyHub {
    if (gatedFollowPerProfile[profileId].remoteChainId == sourceChainId) {
      if (!_checkThreshold(follower, gatedFollowPerProfile[profileId])) {
        revert Errors.FollowInvalid();
      }
    } else {
      // make the async balance check, expect result in `#_nonblockingLzReceive`
      _lzSend(
        gatedFollowPerProfile[profileId].remoteChainId,
        abi.encode(
          follower,
          gatedFollowPerProfile[profileId].remoteContract,
          profileId,
          gatedFollowPerProfile[profileId].balanceThreshold
        ),
        payable(follower),
        zroPaymentAddress,
        bytes("")
      );

      // @TODO: the only feedback to give back to LensHub is a revert if the follow is invalid
      // - we won't know if the follow is valid or not until after the async execution on the remote chain
      // - even if we used an oracle for a data read, it's async
      // - we either
      // 1) return some kind of pending state so LensHub doesn't immediately mint the follow nft
      // 2) maintain some permission to later execute the minting of follow nfts if the async check is successful
    }
  }

  /**
   * @dev We don't need to execute any additional logic on transfers in this follow module.
   */
  function followModuleTransferHook(
    uint256 profileId,
    address from,
    address to,
    uint256 followNFTTokenId
  ) external override {}

  // @TODO: pending how to handle async requests
  function _nonblockingLzReceive(
    uint16 _srcChainId,
    bytes memory _srcAddress,
    uint64 _nonce,
    bytes memory _payload
  ) internal override {

  }

  /**
   * @dev Check that `account` meets the threshold of held tokens in `tokenContract`; we use the standard `#balanceOf`
   * function signature for ERC721 and ERC20
   */
  function _checkThreshold(address account, GatedFollowData memory data) private returns (bool) {
    (
      bool success,
      bytes memory result
    ) = address(data.remoteContract).call(abi.encodeWithSignature("balanceOf(address)", account));

    if (!success) return false;

    (uint256 balance) = abi.decode(result, (uint256));

    return balance >= data.balanceThreshold;
  }
}
