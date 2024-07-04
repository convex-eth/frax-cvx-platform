// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/IERC4626.sol";
import "../interfaces/IFraxLend.sol";
import "../interfaces/IFeeReceiver.sol";
import "../interfaces/IDualOracle.sol";

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IMigrator{
    function migrate() external;
}

/*
cvxFXB
a fxb token wrapper that borrows against the fxb for sfrax in the background
- compound fxb token with profits
- minimalized trust (mostly immutable except for sfrax interest processing)
- withdraw underlying at any time (assuming fraxlend repayment isnt paused)
- open calls for anyone to balance
*/
contract cvxFXB is ERC20, ReentrancyGuard, IERC4626{
    using SafeERC20 for IERC20;

    address public stakingToken;
    address public fraxlend;
    address public immutable frax;
    address public immutable sfrax;
    uint256 public constant minimumInitialDeposit = 1e18;
    uint256 public constant EXCHANGE_PRECISION = 1e18;
    uint256 public constant LTV_PRECISION = 100000;

    address public operator;
    address public owner;
    address public pendingOwner;
    address public migratorRole;
    address public pendingMigratorRole;
    address public migrationContract;
    uint256 public migrationTime;
    bool public isPaused;

    uint256 public borrowBound;
    uint256 public repayBound;
    uint256 public utilBound;

    address public swapper;
    address public feeCollector;
    uint256 public fee;
    uint256 public swapbuffer;

    //events
    event SetPendingOwner(address indexed _address);
    event SetPendingMigrationRole(address indexed _address);
    event SetMigrationContract(address indexed _address);
    event SetOperator(address indexed _address);
    event SetSwapper(address indexed _address, uint256 _buffer);
    event SetFees(address indexed _address, uint256 _fees);
    event SetBounds(uint256 _borrow, uint256 _repay, uint256 _util);
    event SetPaused(bool _paused);
    event OwnerChanged(address indexed _address);
    event MigrationRoleChanged(address indexed _address);
    event Deposit(
        address indexed sender,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 share
    );

    constructor(address _fxb, address _lend, address _frax, address _sfrax, address _migratorRole) ERC20(
            "Convex FXB",
            "cvxFXB"
        ){
        stakingToken = _fxb;
        fraxlend = _lend;
        frax = _frax;
        sfrax = _sfrax;
        owner = msg.sender;
        operator = msg.sender;
        migratorRole = _migratorRole;
        borrowBound = 97000;
        repayBound = 99000;
        utilBound = 95000;

        IERC20(frax).approve(sfrax, type(uint256).max);
        IERC20(frax).approve(fraxlend, type(uint256).max);
        IERC20(stakingToken).approve(fraxlend, type(uint256).max);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!o_auth");
        _;
    }

    modifier onlyMigratorRole() {
        require(migratorRole == msg.sender, "!m_auth");
        _;
    }

    modifier onlyOperator() {
        require(owner == msg.sender || operator == msg.sender, "!op_auth");
        _;
    }

    //set pending owner
    function setPendingOwner(address _po) external onlyOwner{
        pendingOwner = _po;
        emit SetPendingOwner(_po);
    }

    //claim ownership
    function acceptPendingOwner() external {
        require(pendingOwner != address(0) && msg.sender == pendingOwner, "!p_owner");

        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnerChanged(owner);
    }

    //set pending migration role
    function setPendingMigrationRole(address _pmr) external onlyMigratorRole{
        pendingMigratorRole = _pmr;
        emit SetPendingMigrationRole(_pmr);
    }

    //claim migration role
    function acceptPendingMigrationRole() external {
        require(pendingMigratorRole != address(0) && msg.sender == pendingMigratorRole, "!p_migrationRole");

        migratorRole = pendingMigratorRole;
        pendingMigratorRole = address(0);
        emit MigrationRoleChanged(migratorRole);
    }

    function setMigrationContract(address _migrateContract) external onlyMigratorRole{
        migrationContract = _migrateContract;
        migrationTime = block.timestamp + 1 weeks; //set timelock of migration
        emit SetMigrationContract(_migrateContract);
    }

    function migrate(address _newfxb, address _newfraxlend) external onlyMigratorRole{
        require(migrationContract != address(0),"!mcontract");
        require(block.timestamp >= migrationTime, "!mtime");

        //repay
        _repayShares(IFraxLend(fraxlend).userBorrowShares(address(this)));
        //withdraw collateral
        IFraxLend(fraxlend).removeCollateral(IFraxLend(fraxlend).userCollateralBalance(address(this)), address(this));
        //send underlying to migrator
        IERC20(stakingToken).safeTransfer(migrationContract, IERC20(stakingToken).balanceOf(address(this)));
        //update token and fraxlend
        stakingToken = _newfxb;
        fraxlend = _newfraxlend;
        //tell migrator to execute
        IMigrator(migrationContract).migrate();

        //reset migrator settings
        migrationContract = address(0);
        //reset swapper
        swapper = address(0);
        emit SetSwapper(address(0), swapbuffer);
        //set to pause so that owner can adjust settings after migration
        isPaused = true;
        emit SetPaused(true);
    }

    //set operator
    function setOperator(address _o) external onlyOwner{
        operator = _o;
        emit SetOperator(_o);
    }

    function setPaused(bool _pause) external onlyOwner{
        if(_pause){
            //repay
            _repayShares(IFraxLend(fraxlend).userBorrowShares(address(this)));
        }
        isPaused = _pause;
        emit SetPaused(_pause);
    }

    function setSwapper(address _swap, uint256 _buffer) external onlyOwner{
        swapper = _swap;
        swapbuffer = _buffer;
        emit SetSwapper(_swap, _buffer);
    }

    function setFees(address _feeCollector, uint256 _fee) external onlyOwner{
        require(_fee <= LTV_PRECISION, "invalid fee");
        feeCollector = _feeCollector;
        fee = _fee;
        emit SetFees(_feeCollector, _fee);
    }

    function setBounds(uint256 _borrowb, uint256 _repayb, uint256 _utilb) external onlyOperator{
        require(_repayb >= _borrowb+1000 && _repayb <= 99000,"repay gap");
        require(_utilb < LTV_PRECISION, "util gap");

        borrowBound = _borrowb;
        repayBound = _repayb;
        utilBound = _utilb;

        emit SetBounds(_borrowb, _repayb, _utilb);
    }

    function deposit(uint256 _assets, address _receiver) external returns (uint256 shares){

         if (_assets > 0) {
            if(totalSupply() == 0){
                require(_assets >= minimumInitialDeposit, "!min init dep");
            }
            shares = previewDeposit(_assets);
            if(shares > 0){
                _mint(_receiver, shares);
                IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), _assets);
                updateBalances();
                emit Deposit(msg.sender, _receiver, _assets, shares);
            }
        }
    }

    function mint(uint256 _shares, address _receiver) external override returns (uint256 assets){

        if (_shares > 0) {
            if(totalSupply() == 0){
                require(_shares >= minimumInitialDeposit, "!min init dep");
            }
            assets = previewMint(_shares);
            if(assets > 0){
                _mint(_receiver, _shares);
                IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), assets);
                updateBalances();
                emit Deposit(msg.sender, _receiver, assets, _shares);
            }
        }
    }

    function redeem(uint256 _shares, address _receiver, address /*_owner*/) public override returns (uint256 assets){

        if (_shares > 0) {
            assets = previewRedeem(_shares);
            _burn(msg.sender, _shares);
            _removeCollateral(assets);
            IERC20(stakingToken).safeTransfer(_receiver, assets);
            updateBalances(); //update balances after collateral has been sent back
            emit Withdraw(msg.sender, _receiver, msg.sender, _shares, assets);
        }
    }

    function withdraw(uint256 _amount, address _receiver, address /*_owner*/) public override returns(uint256 shares){

        if (_amount > 0) {
            shares = previewWithdraw(_amount);
            _burn(msg.sender, shares);
            _removeCollateral(_amount);
            IERC20(stakingToken).safeTransfer(_receiver, _amount);
            updateBalances(); //update balances after collateral has been sent back
            emit Withdraw(msg.sender, _receiver, msg.sender, shares, _amount);
        }
    }

    //erc4626
    function asset() external view returns(address){
        return stakingToken;
    }

    function totalAssets() public view returns(uint256 assets){
        assets = IERC20(stakingToken).balanceOf(address(this));
        assets += IFraxLend(fraxlend).userCollateralBalance(address(this));
    }

    function convertToShares(uint256 _assets) public override view returns (uint256 shares){
        if (totalSupply() == 0) {
            shares = _assets;
        } else {
            shares = _assets * totalSupply() / totalAssets();
        }
    }

    function convertToAssets(uint256 _shares) public override view returns (uint256 assets){
        if(totalSupply() > 0){
            assets = totalAssets() * _shares / totalSupply();
        }else{
            assets = _shares;
        }
    }

    function convertToSharesRoundUp(uint256 _assets) internal view returns (uint256 shares){
        if (totalSupply() == 0) {
            shares = _assets;
        } else {
            shares = _assets * totalSupply() / totalAssets();
            if ( shares * totalAssets() / totalSupply() < _assets) {
                shares = shares+1;
            }
        }
    }

    function convertToAssetsRoundUp(uint256 _shares) internal view returns (uint256 assets){
        if(totalSupply() > 0){
            assets = totalAssets() * _shares / totalSupply();
            if ( assets * totalSupply() / totalAssets() < _shares) {
                assets = assets+1;
            }
        }else{
            assets = _shares;
        }
    }

    function maxDeposit(address /*_receiver*/) external override pure returns (uint256){
        return type(uint256).max;
    }
    function maxMint(address /*_receiver*/) external override pure returns (uint256){
        return type(uint256).max;
    }
    function previewDeposit(uint256 _amount) public override view returns (uint256){
        return convertToShares(_amount);
    }
    function previewMint(uint256 _shares) public override view returns (uint256){
        return convertToAssetsRoundUp(_shares); //round up
    }
    function maxWithdraw(address _owner) external override view returns (uint256){
        return convertToAssets(balanceOf(_owner));
    }
    function previewWithdraw(uint256 _amount) public override view returns (uint256){
        return convertToSharesRoundUp(_amount); //round up
    }
    function maxRedeem(address _owner) external override view returns (uint256){
        return balanceOf(_owner);
    }
    function previewRedeem(uint256 _shares) public override view returns (uint256){
        return convertToAssets(_shares);
    }

    //get our max borrowable amount
    function maxBorrowable(uint256 _collateralAmount) public view returns (uint256) {
        IFraxLend.ExchangeRateInfo memory exInfo = IFraxLend(fraxlend).exchangeRateInfo();
        //look directly at oracle to keep this a view function
        (,,uint256 exchangeRate) = IDualOracle(exInfo.oracle).getPrices();

        uint256 maxltv = IFraxLend(fraxlend).maxLTV();        

        //calc our max borrowable based on max ltv, the collateral amount, and the current exchange rate
        //exchange rate is borrow token value/collateral token value
        //thus in fxb case should be above 1.0 and trend down to 1.0 at maturity
        uint256 maxborrow = maxltv * _collateralAmount * EXCHANGE_PRECISION / LTV_PRECISION / exchangeRate;

        //get our current borrowed
        uint256 borrowshares = IFraxLend(fraxlend).userBorrowShares(address(this));
        uint256 borrowamount = IFraxLend(fraxlend).toBorrowAmount(borrowshares,true,true);

        //calculate utilization bounds using updated interest fees
        (,,,,IFraxLend.VaultAccount memory totalAsset, IFraxLend.VaultAccount memory totalBorrow) = IFraxLend(fraxlend).previewAddInterest();
        uint256 totallending = totalAsset.amount;
        uint256 totalborrowed = totalBorrow.amount;
        //remove current borrowed amount as we are considering what our full position could be
        totalborrowed -= borrowamount;
        //available for us to use
        uint256 available = totallending - totalborrowed;

        //only use whats available above a utilization threshold
        uint256 utilbuffer = totallending * (LTV_PRECISION-utilBound) / LTV_PRECISION;
        available = available > utilbuffer ? available - utilbuffer : 0;

        //if our ltv is above available, clamp to available
        maxborrow = maxborrow > available ? available : maxborrow;

        return maxborrow;
    }

    function _addCollateral() internal{
        uint256 balance = IERC20(stakingToken).balanceOf(address(this));
        if(balance > 0){
            IFraxLend(fraxlend).addCollateral(balance, address(this));
        }
    }

    function _removeCollateral(uint256 _amount) internal{
        uint256 balance = IERC20(stakingToken).balanceOf(address(this));
        if(_amount > balance){
            //repay
            _repayShares(IFraxLend(fraxlend).userBorrowShares(address(this)));
            //remove
            IFraxLend(fraxlend).removeCollateral(_amount - balance, address(this));
        }
    }

    function _borrow(uint256 _amount) internal{
        if(_amount > 0){
            //update exchange rates (will be called anyway in borrow and cheap on second call if same block)
            (bool isBorrowAllowed,,) = IFraxLend(fraxlend).updateExchangeRate();
            if(isBorrowAllowed){
                //borrow
                IFraxLend(fraxlend).borrowAsset(_amount, IERC20(stakingToken).balanceOf(address(this)), address(this));
            }
        }
        //deposit to sfrax any frax available
        IERC4626(sfrax).deposit(IERC20(frax).balanceOf(address(this)), address(this));
    }

    function _repayShares(uint256 _shares) internal{
        if(_shares > 0){
            //withdraw from sfrax
            IERC4626(sfrax).redeem(IERC20(sfrax).balanceOf(address(this)), address(this), address(this));
            //repay
            IFraxLend(fraxlend).repayAsset(_shares,address(this));
        }
    }

    //collateral added or removed. update borrowing
    function updateBalances() public{
        //exit gracefully if paused
        if(isPaused) return;

        //get max borrow and bounds
        uint256 maxborrow = maxBorrowable(totalAssets());
        uint256 borrowbound = maxborrow * borrowBound / LTV_PRECISION;
        uint256 repaybound = maxborrow * repayBound / LTV_PRECISION;

        //get current borrow amount
        uint256 borrowshares = IFraxLend(fraxlend).userBorrowShares(address(this));
        uint256 borrowamount = IFraxLend(fraxlend).toBorrowAmount(borrowshares,true,true);
        
        if(borrowamount > repaybound){
            //repay and reset back to borrow bound
            _repayShares(borrowshares);
            _borrow(borrowbound);
        }else if(borrowbound > borrowamount){
            //borrow more up to bound
            _borrow(borrowbound - borrowamount);
        }else{
            //else keep borrowing as is. update any loose underlying or frax
            _addCollateral();
            _borrow(0);
        }
    }

    //process rewards
    //sends frax to an outside contract to process
    //this is trust minimalized by repaying all debt first
    //so that no borrowed frax can be sent out
    function processRewards() external{
        require(swapper != address(0),"!swapper");
        require(totalSupply() >= minimumInitialDeposit, "!min init dep");

        //first repay everything and withdraw from sfrax
        _repayShares(IFraxLend(fraxlend).userBorrowShares(address(this)));

        //get frax left over
        uint256 fraxbalance = IERC20(frax).balanceOf(address(this));
        
        //leave a buffer in case there are gaps between sfrax reward cycles etc
        require(fraxbalance > swapbuffer,"!buffer");
        fraxbalance -= swapbuffer;

        //take fees
        if(feeCollector != address(0) && fee > 0){
            uint256 feeamount = fraxbalance * fee / LTV_PRECISION;
            IERC20(frax).transfer(feeCollector, feeamount);
            fraxbalance -= feeamount;
        }

        //send remaining to swapper
        IERC20(frax).transfer(swapper, fraxbalance);
        IFeeReceiver(swapper).processFees();
    }

    //helper function
    //get difference of outstanding debt vs frax available
    //note, does not take swapbuffer into account
    function getProfit() external view returns(int256){
        uint256 borrowshares = IFraxLend(fraxlend).userBorrowShares(address(this));
        uint256 borrowamount = IFraxLend(fraxlend).toBorrowAmount(borrowshares,true,true);
        uint256 fraxb = IERC4626(sfrax).previewRedeem(IERC20(sfrax).balanceOf(address(this)));

        return int256(fraxb) - int256(borrowamount);
    }

    //helper function to check if updateBalances() should be called
    function needsUpdate() external view returns(bool){
        //check if paused locally
        if(isPaused){
            return false;
        }

        //check if we have frax or fxb to deposit
        if(IERC20(frax).balanceOf(address(this)) > 0){
            return true;
        }
        if(IERC20(stakingToken).balanceOf(address(this)) > 0){
            return true;
        }

        
        //get max borrow and bounds
        uint256 maxborrow = maxBorrowable(totalAssets());
        uint256 borrowbound = maxborrow * borrowBound / LTV_PRECISION;
        uint256 repaybound = maxborrow * repayBound / LTV_PRECISION;

        //get current borrow amount
        uint256 borrowshares = IFraxLend(fraxlend).userBorrowShares(address(this));
        uint256 borrowamount = IFraxLend(fraxlend).toBorrowAmount(borrowshares,true,true);
        
        if(borrowamount > repaybound){
            //need to repay/reduce
            return true;
        }else if(borrowbound > borrowamount){

            //check oracle conditions for borrowing more directly from oracle to keep as a view function
            //otherwise could call fraxlend.updateExchangeRate() and use isBorrowAllowed
            IFraxLend.ExchangeRateInfo memory exInfo = IFraxLend(fraxlend).exchangeRateInfo();
            (,uint256 lowexchangeRate,uint256 highexchangeRate) = IDualOracle(exInfo.oracle).getPrices();
            uint256 _deviation = (LTV_PRECISION *
                (highexchangeRate - lowexchangeRate)) /
                highexchangeRate;
            if (_deviation > exInfo.maxOracleDeviation) {
                return false;
            }

            //can borrow more
            return true;
        }

        //no need to update now
        return false;
    }
}