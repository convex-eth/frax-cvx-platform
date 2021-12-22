const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const IERC20 = artifacts.require("IERC20");
const BoosterPlaceholder = artifacts.require("BoosterPlaceholder");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IDelegation = artifacts.require("IDelegation");



contract("deploy contracts", async accounts => {
  it("should successfully deploy", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    let fxs = await IERC20.at(contractList.frax.fxs);
    let vefxs = await IERC20.at(contractList.frax.vefxs);
    
    //deploy
    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    console.log("voteProxy: " +voteproxy.address);
    
    console.log("deploying...");
    let cvxfxs = await cvxFxsToken.new({from:deployer});
    let fxsdeposit = await FxsDepositor.new(voteproxy.address, cvxfxs.address, {from:deployer});
    let operator = await BoosterPlaceholder.new(voteproxy.address,{from:deployer});

    //set operators
    await voteproxy.setDepositor(fxsdeposit.address,{from:deployer});
    await voteproxy.setOperator(operator.address,{from:deployer});
    await cvxfxs.setOperator(fxsdeposit.address,{from:deployer});
    await voteproxy.setOwner(multisig,{from:deployer});

    //initial lock
    var fxsAmount = await fxs.balanceOf(deployer);
    await fxs.transfer(voteproxy.address, fxsAmount, {from:deployer});
    console.log("sent initial fxs");
    await fxsdeposit.initialLock({from:deployer});
    console.log("locked");

    //set fee manager to multi after initial lock
    await fxsdeposit.setFeeManager(multisig,{from:deployer});

    //set delegation
    let delegation = await IDelegation.at("0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446");
    var spaceHex = "0x"+Buffer.from('frax.eth', 'utf8').toString('hex');
    console.log("space(hex): " +spaceHex);
    await operator.setDelegate(delegation.address, deployer, spaceHex, {from:deployer});
    await delegation.delegation(voteproxy.address,spaceHex).then(a=>console.log("delegated to: " +a));

    //set owner to multisig after delegation
    await operator.setOwner(multisig,{from:deployer});


    console.log("deployed");
    

    console.log("contract addresses:");
    contractList.system.cvxFxs = cvxfxs.address;
    contractList.system.fxsDepositor = fxsdeposit.address;
    contractList.system.booster = operator.address;
    jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });

    console.log("booster: " +operator.address);
    console.log("cvxFxs: " +cvxfxs.address);
    console.log("fxsDepositor: " +fxsdeposit.address);
    
  });
});


