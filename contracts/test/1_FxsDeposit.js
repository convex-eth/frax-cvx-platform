const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

// const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");

// const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
// const BaseRewardPool = artifacts.require("BaseRewardPool");
// const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
// //const cvxCrvRewardPool = artifacts.require("cvxCrvRewardPool");
// const cvxRewardPool = artifacts.require("cvxRewardPool");
// const ConvexToken = artifacts.require("ConvexToken");
// const cvxCrvToken = artifacts.require("cvxCrvToken");
// const StashFactory = artifacts.require("StashFactory");
// const RewardFactory = artifacts.require("RewardFactory");


const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");
const IVoting = artifacts.require("IVoting");
const IVoteStarter = artifacts.require("IVoteStarter");
const IWalletCheckerDebug = artifacts.require("IWalletCheckerDebug");
const IEscro = artifacts.require("IEscro");




contract("FXS Deposits", async accounts => {
  it("should successfully run", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    let fxs = await IERC20.at(contractList.frax.fxs);
    // let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let vefxs = await IERC20.at(contractList.frax.vefxs);
    let feeDistro = await IFeeDistro.at(contractList.frax.vefxsRewardDistro);
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let walletChecker = await IWalletCheckerDebug.at(contractList.frax.walletChecker);
    let escrow = await IEscro.at(contractList.frax.vefxs);
    let checkerAdmin = "0x234D953a9404Bf9DbC3b526271d440cD2870bCd2";


    let userA = accounts[0];
    let userB = accounts[1];
    let userC = accounts[2];
    let userD = accounts[3];
    let userZ = "0xAAc0aa431c237C2C0B5f041c8e59B3f1a43aC78F";
    var userNames = {};
    userNames[userA] = "A";
    userNames[userB] = "B";
    userNames[userC] = "C";
    userNames[userD] = "D";
    userNames[userZ] = "Z";

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    //deploy
    let voteproxy = await FraxVoterProxy.new({from:deployer});
    let cvxfxs = await cvxFxsToken.new({from:deployer});
    let fxsdeposit = await FxsDepositor.new(voteproxy.address, cvxfxs.address, {from:deployer});

    await voteproxy.setDepositor(fxsdeposit.address,{from:deployer});
    let operator = deployer;
    await voteproxy.setOperator(operator,{from:deployer});
    await cvxfxs.setOperator(fxsdeposit.address,{from:deployer});
    console.log("deployed");

     // //add to whitelist
    await walletChecker.approveWallet(voteproxy.address,{from:checkerAdmin,gasPrice:0});
    console.log("approved wallet");
    let isWhitelist = await walletChecker.check(voteproxy.address);
    console.log("is whitelist? " +isWhitelist);


    //exchange for fxs
    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //exchange for crv
    await weth.sendTransaction({value:web3.utils.toWei("10.0", "ether"),from:userA});
    var wethbal = await weth.balanceOf(userA);
    await weth.approve(exchange.address, 0,{from:userA});
    await weth.approve(exchange.address,wethbal,{from:userA});
    await exchange.swapExactTokensForTokens(wethbal,0,[weth.address,fxs.address],userA,starttime+3000,{from:userA});
    let startingfxs = await fxs.balanceOf(userA);
    console.log("fxs to deposit: " +startingfxs);

    await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userB});
    var wethbal = await weth.balanceOf(userB);
    await weth.approve(exchange.address, 0,{from:userB});
    await weth.approve(exchange.address,wethbal,{from:userB});
    await exchange.swapExactTokensForTokens(wethbal,0,[weth.address,fxs.address],userB,starttime+3000,{from:userB});
    let initFxs = await fxs.balanceOf(userB);
    console.log("fxs to init: " +initFxs);

    await fxs.transfer(voteproxy.address, initFxs, {from:userB});
    console.log("sent init");
    await fxs.balanceOf(voteproxy.address).then(a=>console.log("fxs on staker: " +a));

    await fxsdeposit.initialLock({from:deployer});
    console.log("init locked");

    await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));


    console.log("continue deposits...");
    await fxs.approve(fxsdeposit.address,0,{from:userA});
    await fxs.approve(fxsdeposit.address,startingfxs,{from:userA});
    await fxsdeposit.deposit(startingfxs,true,addressZero,{from:userA});
    console.log("fxs deposited");

    await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));
    await cvxfxs.balanceOf(userA).then(a=>console.log("cvxfxs of user A: " +a));


    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    await advanceTime(day);
    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    await voteproxy.claimFees(feeDistro.address, fxs.address,{from:deployer});
    await fxs.balanceOf(operator).then(a=>console.log("fxs of operator: " +a));
    await advanceTime(day);
    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    await voteproxy.claimFees(feeDistro.address, fxs.address,{from:deployer});
    await fxs.balanceOf(operator).then(a=>console.log("fxs of operator: " +a));
    await advanceTime(day);
    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    await voteproxy.claimFees(feeDistro.address, fxs.address,{from:deployer});
    await fxs.balanceOf(operator).then(a=>console.log("fxs of operator: " +a));
    await advanceTime(day);


  });
});


