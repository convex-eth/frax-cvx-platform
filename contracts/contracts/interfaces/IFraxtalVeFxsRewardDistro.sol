// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IFraxtalVeFxsRewardDistro {
    function userVeFXSCheckpointed(address _account) external view returns(uint256 _balance);
    // function ttlCombinedVeFXS(address _account) external view returns(uint256 _balance);
    // function ttlCombinedVeFXSTotalSupply() external view returns(uint256 _supply);
    function totalVeFXSParticipating() external view returns(uint256 _supply);
    function yieldPerVeFXS() external view returns(uint256 _rate);
    function yieldRate() external view returns(uint256 _rate);
    function earned(address _account) external view returns (uint256 _earned);
    function getYield() external returns (uint256 _yield0);
}