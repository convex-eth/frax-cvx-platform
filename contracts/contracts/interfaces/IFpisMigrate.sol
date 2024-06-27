// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IFpisMigrate {
   function setPendingOwner(address _po) external;
   function acceptPendingOwner() external;
   function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory);
   function withdrawTo(address _asset, uint256 _amount, address _to) external;
   function migrate(uint256 _fpisAmount, uint256 _cvxfpisAmount) external;
}