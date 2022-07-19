// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IJointVaultManager{
    function getOwnerFee(uint256 _amount, address _usingProxy) external view returns(uint256 _feeAmount, address _feeDeposit);
    function getCoownerFee(uint256 _amount, address _usingProxy) external view returns(uint256 _feeAmount, address _feeDeposit);
    function setDelegate(bytes32 _id, address _delegate) external;
    function delegation(address _address, bytes32 _id) external view returns(address);
    function jointownerProxy() external view returns(address);
    function isAllowed(address _account) external view returns(bool);
}