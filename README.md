# Convex-Frax Staking Platform

## Overview

The Convex-Frax staking platform allows users to trustlessly stake positions on the Frax Finance Gauge system while borrowing Convex's boosting power via veFXS. The Convex system creates unique proxy vaults for each user which only they can control.  This isolates deposits and keeps the user in control of their funds without any risk of admin controls gaining access.  These proxies are then given permission to share in using Convex's veFXS which increases farming efficiency.  In return for this boost, Convex takes a percentage of FXS farmed and distributes to cvxFXS (currently via the cvxFXS/FXS LP pool) and vlCVX.

## Pool Creation Flow

#### Convex Creates Vault Implementation Contracts
This implmentation contract is a proxy staking interface to the Frax gauge. Allowing various implementations allows Convex to adapt to different products and staking contracts. For example, erc20 staking and uniswap v3 nft staking.
(Reference: StakingProxyERC20.sol)

#### Convex Create A Pool And Assigns An Implementation
A pool is created with an implementation address and other important information like frax staking address.  A reward contract is also created to allow additional rewards outside of the gauge system.
(Reference: PoolRegistry.sol, MultiRewards.sol, Booster.sol)

#### Pools Can Be Marked Inactive To Stop Vault Creation
User vaults created from pools are immutable and can not be removed. However Convex can halt future product of vaults.  This will allow things like migrations if required.
(Reference: PoolRegistry.sol, Booster.sol)

## General User Flow

#### User Creates A Personal Vault
A user first clones a pool's implementation contract and assigns themselves as the owner. Only the owner can interact with this proxy vault.
(Reference: Booster.sol, PoolRegistry.sol)

#### Convex Enables User Vault To Use Its veFXS Boosting Power
At time of creation, Convex tells the Frax staking contract that the user vault can share in Convex's boosting power via veFXS.
(Reference: Booster.sol)

#### User Interacts with Vault As A Proxy To Stake On Frax Finance
Users interact with the proxy vault in the same way they would interact with the main Frax staking contract.
(Reference: StakingProxyERC20.sol)

#### User Determines Their Own Lock Timing
Since vaults are unique to each user, each user can decide how long their staking position should be locked for to increase yield. (This is a Frax staking option, not a Convex one)
(Reference: StakingProxyERC20.sol)

#### When User Rewards Are Claimed, A Fee Is Applied To FXS Tokens
Users can claim rewards as they see fit.  Any FXS tokens claimed will have a fee applied and sent to the Convex system to be dispersed to various token holders.
(Reference: StakingProxyERC20.sol, FeeRegistry.sol )

