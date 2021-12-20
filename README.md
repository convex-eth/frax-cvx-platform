# frax-cvx-platform
Frax-Convex Platform

## Minimal Deploy
Will first launch with just cvxFxs deposits while the staking platform is being made.

Required functionality/tests:

Deposits
- deposit fxs for cvxFxs
- Lock for vefxs
- increase lock amount/time

Proxy
- set owner
- set operator
- set depositor
- operator isShutdown condition checks
- operator can call arbitrary calls
- a few helper functions for locking and claiming

Placeholder Operator
- call get fees and withdraw
- isShutdown and shutdownSystem
- able to be replaced


## Changes from Convex-Curve version
- update to solidity 0.8.10
- minimalize main contracts (booster)
- use individual user proxy vaults for staking
- pool creation with implementation contract for user vault
- changes to fee flow
- registry for user to user-vault lookup
- aggregate tracking for total value
- extra reward layer for convex users