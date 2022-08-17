# Deploying a cross-chain NFT with LayerZero

This is a technical overview on how to write and deploy a smart contract that can send and receive messages across chains via [LayerZero](https://layerzero.network/). The source code for this entire project can be found on [this github repo](https://github.com/hyplabs/lz-collect-module).

## Overview

For this project, we wanted to integrate the [Lens protocol](https://lens.xyz/) with [Soulbound Tokens (SBTs)](https://decrypt.co/resources/what-are-soulbound-tokens-building-blocks-for-a-web3-decentralized-society) for the following hypothetical scenario:

```
A popular game will offer an on-chain NFT marketplace (on Optimism) for users
to buy and sell NFTs that can then be used as in-game items. To kickstart their
marketplace, they promote the game with a post on Lens (on Polygon) stating
that anyone that collects their post will have a launch-exclusive vehicle NFT
minted for their gamer account on Optimism.
```

Technically speaking, an action on one chain (the source chain) will trigger a state change on another chain (the destination chain).

The action on the source chain is a Lens "collect" that triggers a post's "Collect Module" that is simply a smart contract that
- determines whether the post can be collected by the caller
- can execute other state-changing logic

Our `LZCollectModule` is set as the "Collect Module" for a Lens post, and every "collect" mints a `OmniSBT` token (non-transferrable) for the collector on the defined destination chain.

Finally, because the `LZCollectModule` contract has to be whitelisted to interact with the lens protocol, we stubbed that functionality out with a [Tenderly action](https://docs.tenderly.co/web3-actions/intro-to-web3-actions).

## Smart contract architecture

### LZCollectModule.sol
`LZCollectModule` is a Lens Collect Module that allows creators to mint soulbound NFTs (OmniSBT) for their followers that are cross-chain compatible, via LayerZero.

The two main functions in this contract are `#initializePublicationCollectModule` and `#processCollect`; these are the callback functions the [LensHub](https://docs.lens.xyz/docs/lenshub) contract invokes when a post is initialized with this module, and when a post with this module is collected.

The constructor arguments include the address for the `OmniSBT` contract. The interactions with that contract are
1. validate that the `chainId` param provided in the init callback is supported
2. create a collection pointer
3. send the "mint" payload to the destination chain via layer zero

Here's the function interface for `#initializePublicationCollectModule`

```solidity
/**
 * @dev Initialize publication collect data for the given `pubId`, including the destination chain to mint the OmniSBT
 * @param profileId: the lens profile
 * @param pubId: the post
 * @param data: encoded data to init this module (followerOnly, chainId)
 */
function initializePublicationCollectModule(
  uint256 profileId,
  uint256 pubId,
  bytes calldata data
) external override onlyHub returns (bytes memory) {}
```

When a post is initialized with this module, the caller must specify two things - whether the post can be only be collected by followers, and which LayerZero `chainId` the NFT should be minted for collectors. These values are encoded in the `data` param.

When a post that has been initialized with this module is collected, our `#processCollect` function is invoked.

```solidity
/**
 * @dev Processes a collect by:
 * - [optional] ensuring the collector is a follower
 * - minting a OmniSBT on the destination chain set
 */
function processCollect(
  uint256, // referrerProfileId
  address collector,
  uint256 profileId,
  uint256 pubId,
  bytes calldata // data
) external override onlyHub {}
```

This is the function that triggers the cross-chain messaging logic in our `OmniSBT` contract.

### OmniSBT.sol
`OmniSBT` creates Soulbound Tokens (SBTs) that mint on a remote destination chain; they are non-transferrable, and burnable.

This contract inherits from our `LzApp` contract which wires up our contract for sending and receiving messages via LayerZero "endpoint" contracts.

Let's look at the constructor for both contracts, as it gives us all the context we need to know before looking at the mint flow.

```solidity
/**
 * @dev OmniSBT contract constructor
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
```

```solidity
/**
 * @dev LzApp contract constructor
 * @param _lzEndpoint: The LZ endpoint contract deployed on this chain
 * @param owner: The contract owner
 * @param remoteChainIds: remote chain ids to set as trusted remotes
 * @param remoteContracts: remote contracts to set as trusted remotes
 */
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
```

In short, we define the accepted chain ids and set the trusted remote contract addresses to relay messages to, and receive messages from. This way, when we process a collect for a post, we know where to relay messages based on the validated info set by the post creator. For more info on the LayerZero endpoint, check out their [docs](https://layerzero.gitbook.io/docs/faq/layerzero-endpoint).

From here, it's helpful to picture the chain of function calls in order to understand the flow.

![OmniSBT mint flow](./lz-collect-module@2x.png)
** it's important to note that `OmniSBT.sol` is a single contract deployed on both Polygon _and_ Optimism - it can send _and_ receive lz messages

1. [on Polygon] someone collects our lens post
2. our callback `LZCollectModule#processCollect` is triggered
3. we call our mint function on `OmnitSBT` which makes an internal call to `#_lzSend`
4. we call `#send` on the `LayerZeroEndpoint` contract with our payload
5. LayerZero moves our payload from Polygon to Optimism via an Oracle and Relayer
6. [on Optimism] the `LayerZeroEndpoint` contract receives our payload
7. our payload is received in our `OmnitSBT` contract via the callback `#lzReceive` which makes an internal call to `#mint`, minting the NFT for the collector

It's worth seeing how we receive messages in our `OmnitSBT` contract
```solidity
// LzApp.sol

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
```

- we assert that only the `LayerZeroEndpoint` contract can call
- we assert that we only receive messages from trusted remote contracts (set in the constructor or via `#setTrustedRemote`)
- we pass along the arguments to `#_blockingLzReceive` to process in a **blocking** way. This means that on transaction reverts/errors `LayerZeroEndpoint` contract will block the message queue from the "source" chain until the transaction is retried successfully ([see more](https://layerzero.gitbook.io/docs/faq/messaging-properties#message-ordering))

The end result: the account that collected the post on Polygon now has a soulbound NFT on Optimism :partying_face:

## Things to note
These contracts are by no means production-ready, and anyone wishing to branch off should consider a few things.

### `LZCollectModule` needs to be whitelisted
As modules need to be whitelisted in order to interact with the lens protocol, we initialize a post with our module. For this reason, we deployed some [light infra](./../tenderly/processCollected.ts) to process collects from our specific lens post.

### We could reduce the lz payload size
Part of the payload in `OmniSBT#mint` includes the uri to use when minting on the destination chain - since this uri is static for all tokens minted from a collection, we could split the payload types by including an enum (ex: `SET_COLLECTION_URI`, `MINT`) that tells our contract at the "destination" chain what to do with our payload. This way, we only ever send this uri value once, and mints are actually cheaper for users.

### We should transfer fees in #processCollect
As part of our light infra to handle the processing of collects, we made the `OmniSBT#mint` function payable to include the fees to be paid to the `LayerZeroEndpoint` contract. To pass this cost off to users, we should transfer native tokens from the collector as part of the logic in `LZCollectModule#processCollect`. To estimate the fees for a given collect, see the [LayerZero docs](https://layerzero.gitbook.io/docs/guides/code-examples/estimating-message-fees).
