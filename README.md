# frax-cvx-platform
Frax-Convex Platform


## todo Changes from Convex-Curve version
- update to solidity 0.8.9
- reward pools are minimal proxy
- combine base and virtual into one multi reward contract
- reduce token transfers on operations. for example mint directly to the stake contract and manually increase balance.
- cheaper force new cycle on rewards
- auto force new reward cycles during claims (and maybe deposits/withdraws too)
- harvest fee modifier per pool?
- remove minting cvx flow
- whitelist harvesters (if none, anyone can)
- remove cvx staking, funnel all cvx fees straight to lockers only


## Things that would be great but not sure if doable on eth L1
- remove harvesters.  always claim and pull rewards when depositing/withdrawing/claiming