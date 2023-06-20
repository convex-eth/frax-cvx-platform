// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IFraxFarmFactory{
    function createFXBPStableFarm(
        address _owner,
        address[] memory _rewardTokens,
        address[] memory _rewardManagers,
        uint256[] memory _rewardRates,
        address[] memory _gaugeControllers,
        address[] memory _rewardDistributors,
        address _stakingToken
    ) external returns (address farm_address);
}