// SPDX-License-Identifier: MIT
pragma solidity >=0.6.11;

interface IFraxRewardDistributor {
    function setGaugeState(address _gauge_address, bool _is_middleman, bool _is_active) external;
}
