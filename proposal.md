# Proposal for handling async, cross-chain execution within Lens Modules

## What are we building
Cross-chain, token-gated follow: a Lens profile can set its follow module such that only wallets above a certain ERC20/ERC721 balance can follow them (e.g., you must own a CryptoPunk on ethereum L1 to follow).

## How are we building it
We have a follow module `LZGatedFollowModule` that is a LayerZero-enabled smart contract; it can send and receive cross-chain messages. When it processes a follow for a profile, we send a message to the destination chain - where we have a separate `LZGatedProxy` contract that simply makes the balance check against the ERC20/ERC721 contract specified on that chain.

## The problem
The only feedback our module can give back to LensHub is a revert if the follow is invalid.
  - we won't know if the follow is valid or not until after the async execution on the remote chain
  - even if we used an oracle for a data read, it's async

## The proposed solution
1. return some kind of pending state so LensHub doesn't immediately mint the follow nft
2. maintain some permission to later execute the follow if the async check is successful

Within our `LZGatedFollowModule` - notice that we now return a boolean value in `#processFollow` meant to signal to the LensHub an intermediate state in this follow request
```solidity
/**
 * @dev Process a follow by:
 * - if the profile has set gated follow data on this chain, just do the token balance check inline and revert if the
 * threshold is not met
 * - else send the payload to our cross-chain proxy on the remote chain to do the check and asynchronously return the
 * result.
 * NOTE: we must have an intermediate state to report back to the LensHub contract
 */
function processFollow(
  address follower,
  uint256 profileId,
  bytes calldata // data
) external override onlyHub returns (bool pendingAsyncRequest) {
  if (gatedFollowPerProfile[profileId].remoteChainId == sourceChainId) {
    if (!_checkThreshold(follower, gatedFollowPerProfile[profileId])) {
      revert Errors.FollowInvalid();
    }

    pendingAsyncRequest = false;
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

    pendingAsyncRequest = true;
  }
}
```

And the proposed change in the lens protocol, within the `InteractionLogic` library function `#follow`
```solidity
...

if (followModule != address(0)) {
  bool pendingAsyncRequest = IFollowModule(followModule).processFollow(
    follower,
    profileIds[i],
    followModuleDatas[i]
  );

  if (!pendingAsyncRequest) {
    tokenIds[i] = IFollowNFT(followNFT).mint(follower);
  } else {
    pendingFollows[followModule][follower][profileId] = true; // or some nonce?
  }
}
...
```

Finally, to complete the flow - our module receives the result from the remote contract and fulfills the process follow request. **This requires a new function in the lens protocol - only callable by whitelisted modules**
```solidity
/**
 * @dev Callback from our `LZGatedProxy` contract deployed on a remote chain
 * - contains the result of the token balance check in `shouldFollow`
 * - make a call to the LensHub to complete the async follow request (they should require that there is a pending
 * follow request, process, and clear it out)
 */
function _nonblockingLzReceive(
  uint16 _srcChainId,
  bytes memory _srcAddress,
  uint64 _nonce,
  bytes memory _payload
) internal override {
  (
    address follower,
    uint256 profileId,
    bool shouldFollow
  ) = abi.decode(data, (address, uint256, bool));

  LensHub(HUB).completePendingFollow(follower, profileId, shouldFollow);
}
```
