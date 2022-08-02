# lz-collect-module

`LZCollectModule` is a Lens Collect Module that allows creators to mint soulbound NFTs (OmniSBT) for their followers that are cross-chain compatible, via LayerZero.
- a creator attaches this module to one of their posts and specifies parameters such as the destination chain id
- any user that collects the post gets an OmniSBT minted on the destination chain

## setup + compile contracts
```
nvm use
yarn
yarn compile
```

## TODO:
- unit tests
- deploy tasks for all LZ supported testnets: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
- await Lens module whitelist process
- documentation
- open source!
