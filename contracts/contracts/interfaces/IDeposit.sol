// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IDeposit {
   function isShutdown() external view returns(bool);
}