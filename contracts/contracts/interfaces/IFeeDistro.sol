// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IFeeDistro {
   function checkpoint() external;
   function getYield() external;
}