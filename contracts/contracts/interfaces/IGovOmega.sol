// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IGovOmega{
    function castVote(uint256 proposalId, uint8 support) external returns (uint256);
    function getVotes(address account, uint256 timepoint) external view returns (uint256);
    function hasVoted(uint256 proposalId, address account) external view returns (bool);
}