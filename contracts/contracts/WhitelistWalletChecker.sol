// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

contract ApprovedReceievers {
    event WalletWhitelisted(address wallet);

    address public owner;

    mapping(address => uint256) public whitelist;

    constructor() {
        owner = msg.sender;
    }

    function addToWhitelist(address _address) public {
        require(msg.sender == owner, "Only owner can add to whitelist");
        whitelist[_address] = 1;
        emit WalletWhitelisted(_address);
    }

    function check(address _wallet) external view returns (uint256) {
        return whitelist[_wallet];
    }
}