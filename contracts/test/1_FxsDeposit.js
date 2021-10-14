const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

// const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");

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

    //deploy
    let voteproxy = await FraxVoterProxy.new({from:deployer});
    let cvxfxs = await cvxFxsToken.new({from:deployer});
    let fxsdeposit = await FxsDepositor.new(voteproxy.address, cvxfxs.address, {from:deployer});

    await voteproxy.setDepositor(fxsdeposit.address,{from:deployer});
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


    // let rewardFactory = await RewardFactory.deployed();
    // let stashFactory = await StashFactory.deployed();
    // let cvx = await ConvexToken.deployed();
    // let cvxCrv = await cvxCrvToken.deployed();
    // let crvDeposit = await CrvDepositor.deployed();
    // let cvxCrvRewards = await booster.lockRewards();
    // let cvxRewards = await booster.stakerRewards();
    // let cvxCrvRewardsContract = await BaseRewardPool.at(cvxCrvRewards);
    // let cvxRewardsContract = await cvxRewardPool.at(cvxRewards);

    // var poolId = contractList.pools.find(pool => pool.name == "3pool").id;
    // let poolinfo = await booster.poolInfo(poolId);
    // let rewardPoolAddress = poolinfo.crvRewards;
    // let rewardPool = await BaseRewardPool.at(rewardPoolAddress);

    // let starttime = await time.latest();
    // console.log("current block time: " +starttime)
    // await time.latestBlock().then(a=>console.log("current block: " +a));

    // //exchange for crv
    // await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userA});
    // let wethForCrv = await weth.balanceOf(userA);
    // await weth.approve(exchange.address, 0,{from:userA});
    // await weth.approve(exchange.address,wethForCrv,{from:userA});
    // await exchange.swapExactTokensForTokens(wethForCrv,0,[weth.address,crv.address],userA,starttime+3000,{from:userA});
    // let startingcrv = await crv.balanceOf(userA);
    // console.log("crv to deposit: " +startingcrv);
    
    // //deposit crv
    // await crv.approve(crvDeposit.address,0,{from:userA});
    // await crv.approve(crvDeposit.address,startingcrv,{from:userA});
    // await crvDeposit.deposit(startingcrv,true,"0x0000000000000000000000000000000000000000",{from:userA});
    // console.log("crv deposited");

    // //check balances, crv should still be on depositor
    // await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    // await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(>0): " +a));
    // await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    // await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(==0): " +a));

    // //try burning from cvxCrv to reclaim crv (only doable before lock made)
    // console.log("try burn 100 cvxCrv");
    // await crvDeposit.burn(100,{from:userA});
    // await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))

    // //add to whitelist
    // await walletChecker.approveWallet(voteproxy.address,{from:checkerAdmin,gasPrice:0});
    // console.log("approve wallet");
    // let isWhitelist = await walletChecker.check(voteproxy.address);
    // console.log("is whitelist? " +isWhitelist);

    // //get more crv
    // await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userA});
    // let wethForCrv2 = await weth.balanceOf(userA);
    // await weth.approve(exchange.address, 0,{from:userA});
    // await weth.approve(exchange.address,wethForCrv2,{from:userA});
    // await exchange.swapExactTokensForTokens(wethForCrv2,0,[weth.address,crv.address],userA,starttime+3000,{from:userA});
    // var crvBal = await crv.balanceOf(userA);
    // console.log("crv to deposit(2): " +crvBal);


    // //split into 3 deposits
    // // 1: initial lock
    // // 2: within 2 weeks (triggers only amount increase)
    // // 3: after 2 weeks (triggers amount+time increase)

    // //deposit crv (after whitelist)
    // await crv.approve(crvDeposit.address,0,{from:userA});
    // await crv.approve(crvDeposit.address,crvBal,{from:userA});
    // await crvDeposit.deposit(1,true,"0x0000000000000000000000000000000000000000",{from:userA});
    // console.log("crv deposited (initial lock)");

    // //check balances, crv should have moved to proxy and vecrv should be >0
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    // await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    // await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    // await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));
    // await escrow.locked__end(voteproxy.address).then(a=>console.log("proxy unlock date: " +a));

    // //try burning again after lock, which will fail
    // await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    // console.log("try burn 100 cvxCrv after whitelist(should catch error)");
    // await crvDeposit.burn(100,{from:userA}).catch(a=>console.log("--> burn reverted"));

    // await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))

    // //increase time a bit
    // await time.increase(86400);
    // await time.advanceBlock();
    // console.log("advance time....");

    // //deposit more crv, this should trigger a amount increase only
    // // vecrv should go up, unlock date should stay the same
    // await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));
    // await crvDeposit.deposit(12345678900,true,"0x0000000000000000000000000000000000000000",{from:userA});
    // console.log("crv deposited (amount increase only)");
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    // await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    // await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    // await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));
    // await escrow.locked__end(voteproxy.address).then(a=>console.log("proxy unlock date: " +a));
    
    // //increase by more than 2 weeks
    // await time.increase(15*86400);
    // await time.advanceBlock();
    // console.log("advance time....");

    // //deposit rest of crv
    // //vecrv AND unlock date should increase
    // crvBal = await crv.balanceOf(userA);
    // await crvDeposit.deposit(crvBal,true,"0x0000000000000000000000000000000000000000",{from:userA});
    // console.log("crv deposited (amount+time increase)");
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    // await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    // await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    // await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));
    // await escrow.locked__end(voteproxy.address).then(a=>console.log("proxy unlock date: " +a));

    // //advance time by 1.5 months
    // await time.increase(45*86400);
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // console.log("advance time....");

    // await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));

    // //get more crv
    // await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userA});
    // let wethForCrv3 = await weth.balanceOf(userA);
    // await weth.approve(exchange.address, 0,{from:userA});
    // await weth.approve(exchange.address,wethForCrv3,{from:userA});
    // await exchange.swapExactTokensForTokens(wethForCrv3,0,[weth.address,crv.address],userA,starttime+3000,{from:userA});
    // crvBal = await crv.balanceOf(userA);
    // console.log("crv to deposit(3): " +crvBal);


    // //deposit crv (after whitelist) without locking immediately
    // await crv.approve(crvDeposit.address,0,{from:userA});
    // await crv.approve(crvDeposit.address,crvBal,{from:userA});
    // await crvDeposit.deposit(crvBal,false,"0x0000000000000000000000000000000000000000",{from:userA});
    // console.log("crv deposited but not locked");
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    // await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    // await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    // await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv: " +a));


    // //NOTE: when testing for release and re creation of lock
    // //this function timeouts in infura when trying to process 4 years.
    // //to test release/createlock, the contract needs to be modified to only lock a month or so

    // //lock deposited crv, caller should get a bit of cvxCrv for compensation
    // await crvDeposit.lockCurve({from:caller});
    // console.log("crv locked")
    // await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    // await cvxCrv.balanceOf(caller).then(a=>console.log("cvxCrv on caller: " +a))
    // await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    // await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    // await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    // await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));


  });
});


