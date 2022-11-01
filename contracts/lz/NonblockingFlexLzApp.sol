// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./LzApp.sol";

/**
 * @title NonblockingFlexLzApp
 * @notice This contract implement's Layerzero's non-blocking pattern, and allows specific chain ids to be configured
 * on deployment. After that, _any_ number of trusted remote contracts can be added via the implementing class, as long
 * as they pass the necessary checks.
 * NOTE: for some level of safety against these remote contracts, we use their `ExcessivelySafeCall` library to limit
 * the attack vector.
 */
abstract contract NonblockingFlexLzApp is LzApp {
  mapping(uint16 => mapping(bytes => mapping(uint64 => bytes32))) public failedMessages;

  event MessageFailed(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes _payload, bytes _reason);
  event RetryMessageSuccess(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes32 _payloadHash);

  constructor(
    address _lzEndpoint,
    address owner,
    uint16[] memory remoteChainIds,
    bytes[] memory remoteContracts
  ) LzApp(_lzEndpoint, owner, remoteChainIds, remoteContracts) {}

  // overriding the virtual function in LzReceiver
  function _blockingLzReceive(
    uint16 _srcChainId,
    bytes memory _srcAddress,
    uint64 _nonce,
    bytes memory _payload
  ) internal virtual override {
    (bool success, bytes memory reason) = address(this).call(
      abi.encodeWithSelector(this.nonblockingLzReceive.selector, _srcChainId, _srcAddress, _nonce, _payload)
    );

    // try-catch all errors/exceptions
    if (!success) {
      failedMessages[_srcChainId][_srcAddress][_nonce] = keccak256(_payload);
      emit MessageFailed(_srcChainId, _srcAddress, _nonce, _payload, reason);
    }
  }

  function nonblockingLzReceive(
    uint16 _srcChainId,
    bytes calldata _srcAddress,
    uint64 _nonce,
    bytes calldata _payload
  ) public virtual {
    // only internal transaction
    require(msg.sender == address(this), "NonblockingLzApp: caller must be LzApp");

    _nonblockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload);
  }

  function retryMessage(
    uint16 _srcChainId,
    bytes calldata _srcAddress,
    uint64 _nonce,
    bytes calldata _payload
  ) public payable virtual {
    // assert there is message to retry
    bytes32 payloadHash = failedMessages[_srcChainId][_srcAddress][_nonce];
    require(payloadHash != bytes32(0), "NonblockingLzApp: no stored message");
    require(keccak256(_payload) == payloadHash, "NonblockingLzApp: invalid payload");

    // clear the stored message
    failedMessages[_srcChainId][_srcAddress][_nonce] = bytes32(0);

    // execute the message. revert if it fails again
    _nonblockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload);
    emit RetryMessageSuccess(_srcChainId, _srcAddress, _nonce, payloadHash);
  }

  // @notice override this function
  function _nonblockingLzReceive(
    uint16 _srcChainId,
    bytes memory _srcAddress,
    uint64 _nonce,
    bytes memory _payload
  ) internal virtual;
}
