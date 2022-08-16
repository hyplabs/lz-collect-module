// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "./ERC4973/ERC4973.sol";
import "./utils/URIStorage.sol";
import "./lz/LzApp.sol";
import "./IOmniSBT.sol";
import "./ILZCollectModule.sol";

/**
 * @title OmniSBT
 * @notice Soulbound Tokens that mint on a remote destination chain; they are non-transferrable, and burnable.
 */
contract OmniSBT is IOmniSBT, URIStorage, ERC4973, LzApp {
  error OnlyCollectModule();
  error OnlyTokenOwner();

  address public collectModule; // the FollowCampaignModule contract that can create collections and mint
  address public zroPaymentAddress; // ZRO payment address
  uint256 public collections; // counter for collections; 1-based

  mapping (uint256 => uint256) public tokenToCollectionId; // _tokenIdCounter => collections

  uint256 internal _tokenIdCounter; // counter for all tokens; 1-based
  bool internal isSource; // is this contract deployed on the "source" chain

  mapping (address => mapping (uint256 => bool)) internal _hasMintedCollection; // account => collections => hasMinted

  modifier onlyCollectModule() {
    if (msg.sender != collectModule) revert OnlyCollectModule();
    _;
  }

  /**
   * @dev contract constructor
   * NOTE: array length will only be one when deploying to a "destination" chain. the "source" contract will contain
   * all references to other deployed contracts
   * @param _lzEndpoint: LayerZero endpoint on this chain to relay messages
   * @param remoteChainIds: whitelisted destination chain ids (supported by LayerZero)
   * @param remoteContracts: whitelisted destination contracts (deployed by us)
   * @param _isSource: whether this contract is deployed on the "source" chain
   */
  constructor(address _lzEndpoint, uint16[] memory remoteChainIds, bytes[] memory remoteContracts, bool _isSource)
    LzApp(_lzEndpoint, msg.sender, remoteChainIds, remoteContracts)
    ERC4973("Omni Soulbound Token", "OMNI-SBT")
  {
    zroPaymentAddress = address(0);
    isSource = _isSource;
  }

  /**
   * @notice Creates a new collection with a fixed `uri` across tokens. Can only be called from our collect module.
   * @param _uri: the metadata uri to be used for all mints of this token
   */
  function createCollection(string memory _uri) external onlyCollectModule returns (uint256) {
    unchecked { collections++; }

    URIStorage._setTokenURI(collections, _uri);

    return collections;
  }

  /**
   * @notice Mints a single token for the `follower` - but on the destination chain specified by `chainId`
   * NOTE: this function is payable as it will be stubbed until lens whitelist; afterwards, we need to transfer native
   * tokens from the collector to this contract in order to fund the lz fee (see LzApp#_lzSend)
   * IDEA: mint NFT on source chain and have a balance of something on the destination chain (ERC998)
   * @param collector: the account attempting to follow
   * @param collectionId: the collection token to mint
   * @param chainId: the destination chain id
   */
  function mint(
    address collector,
    uint256 collectionId,
    uint16 chainId
  ) external onlyCollectModule payable returns (bool) {
    // if the collector has already minted a token of `collectionId`, do not mint
    if (!_hasMintedCollection[collector][collectionId]) {
      _hasMintedCollection[collector][collectionId] = true;

      unchecked { _tokenIdCounter++; }

      // mint them the soulbound nft on the destination chain
      _lzSend(
        chainId,
        abi.encode(collector, collectionId, _tokenIdCounter, URIStorage.tokenURI(collectionId)),
        payable(collector),
        zroPaymentAddress,
        bytes("")
      );

      return true;
    }

    return false;
  }

  /**
   * @notice [DESTINATION CHAIN] Allow the user to redeem their token
   * @param tokenId: the token to burn
   */
  function burn(uint256 tokenId) external override(IOmniSBT, ERC4973) {
    if (_ownerOf[tokenId] != msg.sender) { revert OnlyTokenOwner(); }

    ERC4973._burn(tokenId);

    delete tokenToCollectionId[tokenId];
  }

  /**
   * @notice [DESTINATION CHAIN] returns the metadata uri for a given `tokenId`
   */
  function tokenURI(uint256 tokenId) public view override(IOmniSBT, URIStorage) returns (string memory) {
    return URIStorage.tokenURI(tokenToCollectionId[tokenId]);
  }

  /**
   * @notice returns the remote address for the given `chainId`
   */
  function lzRemoteLookup(uint16 chainId) external view returns (bytes memory) {
    return _lzRemoteLookup[chainId];
  }

  /**
   * @notice allows the contract owner to set the FollowCampaignModule
   * @param _collectModule: our Lens collect module that can call #sendMintMessage
   */
  function setCollectModule(address _collectModule) external onlyOwner {
    collectModule = _collectModule;
  }

  /**
   * @notice allows the contract owner to set the ZRO payment address
   * @param _zroPaymentAddress: ZRO token address used as alternative payment for relayed messages
   */
  function setZroPaymentAddress(address _zroPaymentAddress) external onlyOwner {
    zroPaymentAddress = _zroPaymentAddress;
  }

  /**
   * @notice EIP-165
   */
  function supportsInterface(bytes4 interfaceId) public view override(ERC4973) returns (bool) {
    if (isSource) {
      return interfaceId == 0x01ffc9a7; // ERC165 Interface ID for ERC165
    } else {
      return
        interfaceId == 0x01ffc9a7 || // ERC165 Interface ID for ERC165
        interfaceId == 0x5b5e139f; // ERC165 Interface ID for ERC721Metadata
    }
  }

  /**
   * @dev callback on the destination chain for minting the collector the soulbound NFT
   * TODO: ideally, we don't send the uri every time. maybe can send in the paylod an operation (ex: SET_COLLECTION_URI)
   */
  function _blockingLzReceive(
    uint16, // _srcChainId
    bytes memory, // _srcAddress
    uint64, // _nonce
    bytes memory _payload
  ) internal override {
    (
      address collector,
      uint256 collectionId,
      uint256 tokenId,
      string memory uri
    ) = abi.decode(_payload, (address, uint256, uint256, string));

    ERC4973._mint(collector, tokenId);

    tokenToCollectionId[tokenId] = collectionId;

    if (bytes(URIStorage.tokenURI(collectionId)).length == 0) {
      URIStorage._setTokenURI(collectionId, uri);
    }
  }
}
