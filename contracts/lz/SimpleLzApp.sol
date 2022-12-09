// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@rari-capital/solmate/src/auth/Owned.sol";
import "./interfaces/ILayerZeroUserApplicationConfig.sol";
import "./interfaces/ILayerZeroEndpoint.sol";

/**
 * @title SimpleLzApp
 * @notice Simple, blocking LayerZero-enabled contract that only has one trusted remote chainId and contract
 */
abstract contract SimpleLzApp is Owned, ILayerZeroUserApplicationConfig {
  error NotZeroAddress();

  ILayerZeroEndpoint public immutable lzEndpoint;

  uint16 public remoteChainId;
  bytes public remoteContract;

  /**
   * @dev contract constructor
   * @param _lzEndpoint: The LZ endpoint contract deployed on this chain
   * @param _remoteChainId: remote chain id to be set as the trusted remote
   * @param _remoteContract: remote contract to be set as the trusted remote
   */
  constructor(address _lzEndpoint, address owner, uint16 _remoteChainId, bytes memory _remoteContract) Owned(owner) {
    if (_lzEndpoint == address(0)) { revert NotZeroAddress(); }

    lzEndpoint = ILayerZeroEndpoint(_lzEndpoint);

    remoteChainId = _remoteChainId;
    remoteContract = _remoteContract;
  }

  function _lzSend(
    bytes memory _payload,
    address payable _refundAddress,
    address _zroPaymentAddress,
    bytes memory _adapterParams
  ) internal virtual {
    lzEndpoint.send{value: msg.value}(
      remoteChainId,
      remoteContract,
      _payload,
      _refundAddress,
      _zroPaymentAddress,
      _adapterParams
    );
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
