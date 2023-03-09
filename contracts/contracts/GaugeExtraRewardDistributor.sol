// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IFraxFarmERC20.sol";
import "./interfaces/IConvexWrapper.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


    
contract GaugeExtraRewardDistributor {
    using SafeERC20 for IERC20;

    address public farm;
    address public wrapper;

    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);

    uint256 internal counter;

    event Recovered(address _token, uint256 _amount);
    event Distributed(address _token, uint256 _rate);

    constructor(){}

    function initialize(address _farm, address _wrapper) external {
        require(farm == address(0),"init fail");

        farm = _farm;
        wrapper = _wrapper;
    }

    //owner is farm owner
    modifier onlyOwner() {
        require(msg.sender == IFraxFarmERC20(farm).owner(), "!owner");
        _;
    }

    function recoverERC20(address _tokenAddress, uint256 _tokenAmount) external onlyOwner {
        require(_tokenAddress != crv && _tokenAddress != cvx, "invalid");
        IERC20(_tokenAddress).safeTransfer(IFraxFarmERC20(farm).owner(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    // Add a new reward token to be distributed to stakers
    function distributeReward(address _farm) external{
        //only allow farm to call
        require(msg.sender == farm);

        /**
        * First time this is called by the farm:
        *   - pull in rewards from wrapper
        *   - distribute first reward token
        *   - set reward rate for first reward token
        *   - set counter to one so next call will distribute second reward token
        * Second time this is called by the farm:
        *   - distribute second reward token
        *   - set reward rate for second reward token
        *   - set counter to zero so it can be called next week.
        */
        if (counter == 0) {
            // for the first call here, reward token must be crv the farm expects
            _distributeAndWriteRate(crv, _farm);
            counter++;
        } else {
            // for the second call here, reward token must be cvx the farm expects
            _distributeAndWriteRate(cvx, _farm);
            counter = 0;
        }
    }

    function _distributeAndWriteRate(address _token, address _farm) internal {
        //get rewards
        IConvexWrapper(wrapper).getReward(_farm);

        //get last period update from farm and figure out period
        uint256 duration = IFraxFarmERC20(_farm).rewardsDuration();
        uint256 periodLength = ((block.timestamp + duration) / duration) - IFraxFarmERC20(_farm).periodFinish();

        //reward tokens on farms are constant so dont need to loop, just distribute crv and cvx
        uint256 balance = IERC20(_token).balanceOf(address(this));
        uint256 rewardRate = IERC20(_token).balanceOf(address(this)) / periodLength;
        if(balance > 0){
            IERC20(_token).transfer(farm, balance);
        }
        //if balance is 0, still need to call so reward rate is set to 0
        IFraxFarmERC20(_farm).setRewardVars(_token, rewardRate, address(0), address(this));
        emit Distributed(_token, rewardRate);
    }
}