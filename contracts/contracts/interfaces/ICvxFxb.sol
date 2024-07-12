// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ICvxFxb {
    function setPaused(bool _pause) external;
    function setSwapper(address _swap, uint256 _buffer) external;
    function setFees(address _feeCollector, uint256 _fee) external;
    function setBounds(uint256 _borrowb, uint256 _repayb, uint256 _utilb) external;
    function setUtilBounds(uint256 _utilb) external;
    function totalAssets() external view returns(uint256 assets);
    function borrowBound() external view returns(uint256);
    function repayBound() external view returns(uint256);
    function utilBound() external view returns(uint256);
    function updateBalances() external;
    function maxBorrowable(uint256 _collateralAmount, uint256 _utilityBounds) external view returns (uint256);
}
