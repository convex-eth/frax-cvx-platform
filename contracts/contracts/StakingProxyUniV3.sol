// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./StakingProxyBase.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IFraxFarmUniV3.sol";
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';


contract StakingProxyUniV3 is StakingProxyBase, ReentrancyGuard{
    using SafeERC20 for IERC20;

        address public constant positionManager = address(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    constructor() {
    }

    function vaultType() external pure override returns(VaultType){
        return VaultType.UniV3;
    }

    function vaultVersion() external pure override returns(uint256){
        return 1;
    }

    //initialize vault
    function initialize(address _owner, address _stakingAddress, address , address _rewardsAddress) public override{
        require(owner == address(0),"already init");

        //set variables
        owner = _owner;
        stakingAddress = _stakingAddress;
        rewards = _rewardsAddress;

        //set infinite approval
        INonfungiblePositionManager(positionManager).setApprovalForAll(_stakingAddress, true);
    }

    // Needed to indicate that this contract is ERC721 compatible
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    //create a new locked state of _secs timelength
    function stakeLocked(uint256 _token_id, uint256 _secs) external onlyOwner nonReentrant{
        if(_token_id > 0){
            //pull token from user
            INonfungiblePositionManager(positionManager).safeTransferFrom(msg.sender, address(this), _token_id);

            //stake
            IFraxFarmUniV3(stakingAddress).stakeLocked(_token_id, _secs);
        }

        //checkpoint rewards
        _checkpointRewards();
    }

    //add to a current lock
    function lockAdditional(uint256 _token_id, uint256 _token0_amt, uint256 _token1_amt) external onlyOwner nonReentrant{

        if(_token_id > 0 && _token0_amt > 0 && _token1_amt > 0){
            address token0 = IFraxFarmUniV3(stakingAddress).uni_token0();
            address token1 = IFraxFarmUniV3(stakingAddress).uni_token1();
            //pull tokens directly to staking address
            IERC20(token0).safeTransferFrom(msg.sender, stakingAddress, _token0_amt);
            IERC20(token1).safeTransferFrom(msg.sender, stakingAddress, _token1_amt);

            //add stake - use balance of override,  min in is ignored when doing so
            IFraxFarmUniV3(stakingAddress).lockAdditional(_token_id, _token0_amt, _token1_amt, 0, 0, true);
        }
        
        //checkpoint rewards
        _checkpointRewards();
    }

    //withdraw a staked position
    function withdrawLocked(uint256 _token_id) external onlyOwner nonReentrant{

        //withdraw directly to owner(msg.sender)
        IFraxFarmUniV3(stakingAddress).withdrawLocked(_token_id, msg.sender);

        //checkpoint rewards
        _checkpointRewards();
    }


    //helper function to combine earned tokens on staking contract and any tokens that are on this vault
    function earned() external override returns (address[] memory token_addresses, uint256[] memory total_earned) {
        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmUniV3(stakingAddress).getAllRewardTokens();
        uint256[] memory stakedearned = IFraxFarmUniV3(stakingAddress).earned(address(this));
        
        token_addresses = new address[](rewardTokens.length + IRewards(rewards).rewardTokenLength());
        total_earned = new uint256[](rewardTokens.length + IRewards(rewards).rewardTokenLength());
        //add any tokens that happen to be already claimed but sitting on the vault
        //(ex. withdraw claiming rewards)
        for(uint256 i = 0; i < rewardTokens.length; i++){
            token_addresses[i] = rewardTokens[i];
            total_earned[i] = stakedearned[i] + IERC20(rewardTokens[i]).balanceOf(address(this));
        }

        IRewards.EarnedData[] memory extraRewards = IRewards(rewards).claimableRewards(address(this));
        for(uint256 i = 0; i < extraRewards.length; i++){
            token_addresses[i+rewardTokens.length] = extraRewards[i].token;
            total_earned[i+rewardTokens.length] = extraRewards[i].amount;
        }
    }

    /*
    claim flow:
        claim rewards directly to the vault
        calculate fees to send to fee deposit
        send fxs to a holder contract for fees
        get reward list of tokens that were received
        send all remaining tokens to owner

    A slightly less gas intensive approach could be to send rewards directly to a holder contract and have it sort everything out.
    However that makes the logic a bit more complex as well as runs a few future proofing risks
    */
    function getReward() external override{
        getReward(true);
    }

    //get reward with claim option.
    //_claim bool is for the off chance that rewardCollectionPause is true so getReward() fails but
    //there are tokens on this vault for cases such as withdraw() also calling claim.
    //can also be used to rescue tokens on the vault
    function getReward(bool _claim) public override{

        //claim
        if(_claim){
            // use bool as false at first to claim all farm rewards and process here
            // then call again to claim LP fees but send directly to owner
            IFraxFarmUniV3(stakingAddress).getReward(address(this), false);
            IFraxFarmUniV3(stakingAddress).getReward(owner, true);
        }

        //process fxs fees
        _processFxs();

        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmUniV3(stakingAddress).getAllRewardTokens();

        //transfer
        _transferTokens(rewardTokens);

        //extra rewards
        _processExtraRewards();
    }

    //auxiliary function to supply token list(save a bit of gas + dont have to claim everything)
    //_claim bool is for the off chance that rewardCollectionPause is true so getReward() fails but
    //there are tokens on this vault for cases such as withdraw() also calling claim.
    //can also be used to rescue tokens on the vault
    function getReward(bool _claim, address[] calldata _rewardTokenList) external override{

        //claim
        if(_claim){
            // use bool as false at first to claim all farm rewards and process here
            // then call again to claim LP fees but send directly to owner
            IFraxFarmUniV3(stakingAddress).getReward(address(this), false);
            IFraxFarmUniV3(stakingAddress).getReward(owner, true);
        }

        //process fxs fees
        _processFxs();

        //transfer
        _transferTokens(_rewardTokenList);

        //extra rewards
        _processExtraRewards();
    }

    //there should never be an erc721 on this address but since it is a receiver, allow owner to extract any
    //that may exist
    function recoverERC721(address _tokenAddress, uint256 _token_id) external onlyOwner {
        INonfungiblePositionManager(_tokenAddress).safeTransferFrom(address(this), owner, _token_id);
    }
}
