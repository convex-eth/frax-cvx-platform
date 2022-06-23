// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;



/*

*/
contract JointVaultManager{

    address public constant owner = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant coowner = address(0x59CFCD384746ec3035299D90782Be065e466800B);

    address public constant ownerProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant coownerProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);

    uint256 public ownerIncentive = 200;
    uint256 public coownerIncentive = 200;
    uint256 public boosterIncentive = 1300;
    uint256 public totalFees = 1700;

    uint256 public newOwnerIncentive = 200;
    uint256 public newCoownerIncentive = 200;
    uint256 public newBoosterIncentive = 1300;
    address public feeProposedAddress;

    address public ownerFeeDeposit;
    address public coownerFeeDeposit;

    uint256 public constant maxFees = 2000;
    uint256 public constant FEE_DENOMINATOR = 10000;


    mapping(address => bool) public allowedAddresses;

    event ProposeFees(uint256 _owner, uint256 _coowner, uint256 _booster, address _proposer);
    event AcceptFees(uint256 _owner, uint256 _coowner, uint256 _booster, address _acknowledger);
    event SetOwnerDeposit(address _depost);
    event SetCoownerDeposit(address _depost);
    event SetAllowedAddress(address _account, bool _allowed);

    constructor() {}

    /////// Owner Section /////////

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    modifier onlyJointOwner() {
        require(coowner == msg.sender, "!auth");
        _;
    }

    modifier anyOwner() {
        require(owner == msg.sender || coowner == msg.sender, "!auth");
        _;
    }


    //queue change to platform fees
    function setFees(uint256 _owner, uint256 _coowner, uint256 _booster) external anyOwner{
        require(_owner + _coowner + _booster <= maxFees, "fees over");

        feeProposedAddress = msg.sender;
        newOwnerIncentive = _owner;
        newCoownerIncentive = _coowner;
        newBoosterIncentive = _booster;

        emit ProposeFees(_owner, _coowner, _booster, msg.sender);
    }

    //accept proposed fees from the other owner
    function acceptFees() external anyOwner{
        require(msg.sender != feeProposedAddress, "fees over");
        
        totalFees = newOwnerIncentive + newCoownerIncentive + newBoosterIncentive;

        ownerIncentive = newOwnerIncentive;
        coownerIncentive = newCoownerIncentive;
        boosterIncentive = newBoosterIncentive;

        emit AcceptFees(ownerIncentive, coownerIncentive, boosterIncentive, msg.sender);
    }

    function setDepositAddress(address _deposit) external onlyOwner{
        require(_deposit != address(0),"zero");
        ownerFeeDeposit = _deposit;

        emit SetOwnerDeposit(_deposit);
    }

    function setJointOwnerDepositAddress(address _deposit) external onlyJointOwner{
        require(_deposit != address(0),"zero");
        coownerFeeDeposit = _deposit;

        emit SetCoownerDeposit(_deposit);
    }

    function setAllowedAddress(address _account, bool _allowed) external anyOwner{
        allowedAddresses[_account] = _allowed;

        emit SetAllowedAddress(_account, _allowed);
    }

    function getOwnerFee(uint256 _amount, address _usingProxy) external view returns(uint256 _feeAmount, address _feeDeposit){
        _feeAmount = _amount * (ownerIncentive + (_usingProxy == ownerProxy ? boosterIncentive : 0) ) / FEE_DENOMINATOR;
        _feeDeposit = ownerFeeDeposit;
    }

    function getCoownerFee(uint256 _amount, address _usingProxy) external view returns(uint256 _feeAmount, address _feeDeposit){
        _feeAmount = _amount * (coownerIncentive + (_usingProxy == coownerProxy ? boosterIncentive : 0) ) / FEE_DENOMINATOR;
        _feeDeposit = coownerFeeDeposit;
    }

    function isAllowed(address _account) external view returns(bool){
        return allowedAddresses[_account];
    }
}