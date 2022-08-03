// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@rari-capital/solmate/src/auth/Owned.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroUserApplicationConfig.sol";
import "./interfaces/ILayerZeroEndpoint.sol";

/**
 *
 */
abstract contract LzApp is Owned, ILayerZeroReceiver, ILayerZeroUserApplicationConfig {
  error NotZeroAddress();
  error ArrayMismatch();
  error OnlyEndpoint();
  error RemoteNotFound();
  error OnlyTrustedRemote();

  ILayerZeroEndpoint public immutable lzEndpoint;

  mapping (uint16 => bytes) internal _lzRemoteLookup; // chainId (lz) => endpoint

  constructor(
    address _lzEndpoint,
    address owner,
    uint16[] memory remoteChainIds,
    bytes[] memory remoteContracts
  ) Owned(owner) {
    if (_lzEndpoint == address(0)) { revert NotZeroAddress(); }
    if (remoteChainIds.length != remoteContracts.length) { revert ArrayMismatch(); }

    lzEndpoint = ILayerZeroEndpoint(_lzEndpoint);

    uint256 length = remoteChainIds.length;
    for (uint256 i = 0; i < length;) {
      _lzRemoteLookup[remoteChainIds[i]] = remoteContracts[i];
      unchecked { i++; }
    }
  }

  function _lzSend(
    uint16 _dstChainId,
    bytes memory _payload,
    address payable _refundAddress,
    address _zroPaymentAddress,
    bytes memory _adapterParams
  ) internal virtual {
    if (_lzRemoteLookup[_dstChainId].length == 0) { revert RemoteNotFound(); }

    lzEndpoint.send{value: msg.value}(
      _dstChainId,
      _lzRemoteLookup[_dstChainId],
      _payload,
      _refundAddress,
      _zroPaymentAddress,
      _adapterParams
    );
  }

  function lzReceive(
    uint16 _srcChainId,
    bytes memory _srcAddress,
    uint64 _nonce,
    bytes memory _payload
  ) public virtual override {
    if (msg.sender != address(lzEndpoint)) { revert OnlyEndpoint(); }

    bytes memory trustedRemote = _lzRemoteLookup[_srcChainId];
    if (_srcAddress.length != trustedRemote.length || keccak256(_srcAddress) != keccak256(trustedRemote)) {
      revert OnlyTrustedRemote();
    }

    _blockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload);
  }

  // @dev to be overriden by the concrete class
  function _blockingLzReceive(
    uint16 _srcChainId,
    bytes memory _srcAddress,
    uint64 _nonce,
    bytes memory _payload
  ) internal virtual;

  function setTrustedRemote(uint16 _srcChainId, bytes calldata _srcAddress) external onlyOwner {
    _lzRemoteLookup[_srcChainId] = _srcAddress;
  }

  // @dev generic config for LayerZero user Application
  function setConfig(
    uint16 _version,
    uint16 _chainId,
    uint _configType,
    bytes calldata _config
  ) external override onlyOwner {
    lzEndpoint.setConfig(_version, _chainId, _configType, _config);
  }

  function setSendVersion(uint16 _version) external override onlyOwner {
    lzEndpoint.setSendVersion(_version);
  }

  function setReceiveVersion(uint16 _version) external override onlyOwner {
    lzEndpoint.setReceiveVersion(_version);
  }

  function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external override onlyOwner {
    lzEndpoint.forceResumeReceive(_srcChainId, _srcAddress);
  }

  function getConfig(uint16 _version, uint16 _chainId, address, uint _configType) external view returns (bytes memory) {
    return lzEndpoint.getConfig(_version, _chainId, address(this), _configType);
  }
}
