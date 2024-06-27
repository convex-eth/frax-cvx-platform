// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IDualOracle {
    function getPrices() external view returns (bool _isBadData, uint256 _priceLow, uint256 _priceHigh);

    function decimals() external view returns (uint8);

    function oracleType() external view returns (uint256);

    function name() external view returns (string memory);
}