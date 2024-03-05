// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IConvexWrapperV2.sol";
import "./interfaces/IFraxFarmERC20.sol";
import "./interfaces/IRewards.sol";
import "./interfaces/IPoolRegistry.sol";
import "./interfaces/IFeeRegistry.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


/*
This is a utility library which is mainly used for off chain calculations
*/
contract PoolUtilities{
    address public constant convexProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);
    address public constant vefxs = address(0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0);
    address public constant poolRegistry = address(0x41a5881c17185383e19Df6FA4EC158a6F4851A69);
    address public constant feeRegistry = address(0xC9aCB83ADa68413a6Aa57007BC720EE2E2b3C46D);

    //get weighted reward rates of a specific staking contract(rate per weight unit)
    function weightedRewardRates(address _stakingAddress) public view returns (uint256[] memory weightedRates) {
        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmERC20(_stakingAddress).getAllRewardTokens();
        //get total weight of all stakers
        uint256 totalWeight = IFraxFarmERC20(_stakingAddress).totalCombinedWeight();

        weightedRates = new uint256[](rewardTokens.length);

        if(totalWeight == 0) return weightedRates;

        //calc weighted reward rates
        for (uint256 i = 0; i < rewardTokens.length; i++){ 
            weightedRates[i] = IFraxFarmERC20(_stakingAddress).rewardRates(i) * 1e18 / totalWeight;
        }
    }

    //get boosted reward rate of user at a specific staking contract
    //returns amount user receives per second based on weight/liq ratio
    //%return = userBoostedRewardRate * timeFrame * price of reward / price of LP / 1e18
    function userBoostedRewardRates(address _stakingAddress, address _vaultAddress) external view returns (uint256[] memory boostedRates) {
        //get list of reward tokens
        uint256[] memory wrr = weightedRewardRates(_stakingAddress);

        //get user liquidity and weight
        uint256 userLiq = IFraxFarmERC20(_stakingAddress).lockedLiquidityOf(_vaultAddress);
        uint256 userWeight = IFraxFarmERC20(_stakingAddress).combinedWeightOf(_vaultAddress);

        boostedRates = new uint256[](wrr.length);

        if(userLiq == 0) return boostedRates;

        //calc boosted rates
        for (uint256 i = 0; i < wrr.length; i++){ 
            boostedRates[i] = wrr[i] * userWeight / userLiq;
        }
    }

    
    //get convex vefxs multiplier for a specific staking contract
    function veFXSMultiplier(address _stakingAddress) public view returns (uint256 vefxs_multiplier) {
        uint256 vefxs_bal_to_use = IERC20(vefxs).balanceOf(convexProxy);
        uint256 vefxs_max_multiplier = IFraxFarmERC20(_stakingAddress).vefxs_max_multiplier();

        // First option based on fraction of total veFXS supply, with an added scale factor
        uint256 mult_optn_1 = (vefxs_bal_to_use * vefxs_max_multiplier * IFraxFarmERC20(_stakingAddress).vefxs_boost_scale_factor()) 
                            / (IERC20(vefxs).totalSupply() * 1e18);

        // Second based on old method, where the amount of FRAX staked comes into play
        uint256 mult_optn_2;
        {
            uint256 veFXS_needed_for_max_boost;

            // Need to use proxy-wide FRAX balance if applicable, to prevent exploiting
            veFXS_needed_for_max_boost = IFraxFarmERC20(_stakingAddress).minVeFXSForMaxBoostProxy(convexProxy);

            if (veFXS_needed_for_max_boost > 0){ 
                uint256 user_vefxs_fraction = (vefxs_bal_to_use * 1e18) / veFXS_needed_for_max_boost;
                
                mult_optn_2 = (user_vefxs_fraction * vefxs_max_multiplier) / 1e18;
            }
            else mult_optn_2 = 0; // This will happen with the first stake, when user_staked_frax is 0
        }

        // Select the higher of the two
        vefxs_multiplier = (mult_optn_1 > mult_optn_2 ? mult_optn_1 : mult_optn_2);

        // Cap the boost to the vefxs_max_multiplier
        if (vefxs_multiplier > vefxs_max_multiplier) vefxs_multiplier = vefxs_max_multiplier;
    }

    function isConvexWrapper(address _wrapper) public view returns(bool){
        try IConvexWrapperV2(_wrapper).convexToken(){}catch{
            return false;
        }

        return true;
    }

    function earnedByOwner(uint256 _pid, address _owner) external returns (address[] memory token_addresses, uint256[] memory total_earned) {
        (, address staking, address token, address rewards, ) = IPoolRegistry(poolRegistry).poolInfo(_pid);
        return earned(staking,token,rewards, IPoolRegistry(poolRegistry).vaultMap(_pid, _owner) );
    }

    function earned(uint256 _pid, address _vault) external returns (address[] memory token_addresses, uint256[] memory total_earned) {
        (, address staking, address token, address rewards, ) = IPoolRegistry(poolRegistry).poolInfo(_pid);
        return earned(staking,token,rewards, _vault);
    }

    //helper function to combine earned tokens on staking contract and any tokens that are on this vault
    function earned(address _stakingAddress, address _stakingToken, address _extrarewards, address _vault) public returns (address[] memory token_addresses, uint256[] memory total_earned) {
        //simulate frax pool sync
        try IFraxFarmERC20(_stakingAddress).sync(){}catch{}

        uint256 convexrewardCnt;
        if(isConvexWrapper(_stakingToken)){
            //simulate claim on wrapper
            IConvexWrapperV2(_stakingToken).getReward(_vault);

            convexrewardCnt = IConvexWrapperV2(_stakingToken).rewardLength();
        }

        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmERC20(_stakingAddress).getAllRewardTokens();
        uint256[] memory stakedearned = IFraxFarmERC20(_stakingAddress).earned(_vault);

        uint256 extraRewardsLength;
        if(_extrarewards != address(0)){
            extraRewardsLength = IRewards(_extrarewards).rewardTokenLength();
        }

        token_addresses = new address[](rewardTokens.length + extraRewardsLength + convexrewardCnt);
        total_earned = new uint256[](rewardTokens.length + extraRewardsLength + convexrewardCnt);

        //add any tokens that happen to be already claimed but sitting on the vault
        //(ex. withdraw claiming rewards)
        for(uint256 i = 0; i < rewardTokens.length; i++){
            token_addresses[i] = rewardTokens[i];
            total_earned[i] = stakedearned[i] + IERC20(rewardTokens[i]).balanceOf(_vault);
            if(rewardTokens[i] == fxs){
                total_earned[i] -= total_earned[i] * IFeeRegistry(feeRegistry).totalFees() / 10000;
            }
        }

        if(_extrarewards != address(0)){
            IRewards.EarnedData[] memory extraRewards = IRewards(_extrarewards).claimableRewards(_vault);
            for(uint256 i = 0; i < extraRewards.length; i++){
                token_addresses[i+rewardTokens.length] = extraRewards[i].token;
                total_earned[i+rewardTokens.length] = extraRewards[i].amount;
            }
        }

        //add convex farm earned tokens
        for(uint256 i = 0; i < convexrewardCnt; i++){
            IConvexWrapperV2.RewardType memory rinfo = IConvexWrapperV2(_stakingToken).rewards(i);
            token_addresses[i+rewardTokens.length+extraRewardsLength] = rinfo.reward_token;
            if(rinfo.reward_token != address(0)){
                //claimed so just look at local balance
                total_earned[i+rewardTokens.length+extraRewardsLength] = IERC20(rinfo.reward_token).balanceOf(_vault);
            }
        }
    }
}
