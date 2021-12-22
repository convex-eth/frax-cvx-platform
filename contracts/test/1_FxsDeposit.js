const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

// const Booster = artifacts.require("Booster");
const BoosterPlaceholder = artifacts.require("BoosterPlaceholder");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");

const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");
const IVoting = artifacts.require("IVoting");
const IVoteStarter = artifacts.require("IVoteStarter");
const IWalletCheckerDebug = artifacts.require("IWalletCheckerDebug");
const IVoteEscrow = artifacts.require("IVoteEscrow");
const IDelegation = artifacts.require("IDelegation");


const unlockAccount = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_unlockUnknownAccount",
        params: [address],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

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
    let escrow = await IVoteEscrow.at(contractList.frax.vefxs);
    // let checkerAdmin = "0x234D953a9404Bf9DbC3b526271d440cD2870bCd2";
    let checkerAdmin = "0xB1748C79709f4Ba2Dd82834B8c82D4a505003f27";
    await unlockAccount(checkerAdmin);

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
    // let voteproxy = await FraxVoterProxy.new({from:deployer});
    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    let cvxfxs = await cvxFxsToken.new({from:deployer});
    let fxsdeposit = await FxsDepositor.new(voteproxy.address, cvxfxs.address, {from:deployer});
    let operator = await BoosterPlaceholder.new(voteproxy.address,{from:deployer});

    await voteproxy.setDepositor(fxsdeposit.address,{from:deployer});
    await voteproxy.setOperator(operator.address,{from:deployer});
    await cvxfxs.setOperator(fxsdeposit.address,{from:deployer});
    console.log("deployed");

    //test operator switch
    let operatorB = await BoosterPlaceholder.new(voteproxy.address,{from:deployer});
    await voteproxy.setOperator(operatorB.address,{from:deployer}).catch(a=>console.log("not shutdown: " +a))
    await operator.shutdownSystem({from:deployer});
    await voteproxy.setOperator(deployer,{from:deployer}).catch(a=>console.log("invalid operator: " +a))
    await voteproxy.setOperator(operatorB.address,{from:deployer});
    operator = operatorB;
    console.log("switched to new operator");

     // //add to whitelist
    // await walletChecker.approveWallet(voteproxy.address,{from:checkerAdmin,gasPrice:0});
    // console.log("approved wallet");
    let isWhitelist = await walletChecker.check(voteproxy.address);
    console.log("is whitelist? " +isWhitelist);


    //set delegation
    let delegation = await IDelegation.at("0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446");
    var spaceHex = "0x"+Buffer.from('frax.eth', 'utf8').toString('hex');
    console.log("space(hex): " +spaceHex);
    await operator.setDelegate(delegation.address, deployer, spaceHex, {from:deployer});
    await delegation.delegation(voteproxy.address,spaceHex).then(a=>console.log("delegated to: " +a));

    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //exchange for fxs
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
    await escrow.locked__end(voteproxy.address).then(a=>console.log("lock end: " +a));

    await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));

    await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userB});
    var wethbal = await weth.balanceOf(userB);
    await weth.approve(exchange.address, 0,{from:userB});
    await weth.approve(exchange.address,wethbal,{from:userB});
    await exchange.swapExactTokensForTokens(wethbal,0,[weth.address,fxs.address],userB,starttime+3000,{from:userB});
    let userbBal = await fxs.balanceOf(userB);

    console.log("continue deposits...");
    await fxs.approve(fxsdeposit.address,0,{from:userA});
    await fxs.approve(fxsdeposit.address,startingfxs,{from:userA});
    await fxsdeposit.deposit(startingfxs,true,{from:userA});
    console.log("fxs deposited");
    await escrow.locked__end(voteproxy.address).then(a=>console.log("lock end: " +a));

    await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));
    await cvxfxs.balanceOf(userA).then(a=>console.log("cvxfxs of userA: " +a));

    //have another user deposit after.  increase amount but not time
    console.log("continue deposits...");
    await fxs.approve(fxsdeposit.address,0,{from:userB});
    await fxs.approve(fxsdeposit.address,userbBal,{from:userB});
    await fxsdeposit.deposit(userbBal,true,{from:userB});
    console.log("fxs deposited");
    await escrow.locked__end(voteproxy.address).then(a=>console.log("lock end: " +a));

    await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));
    await cvxfxs.balanceOf(userB).then(a=>console.log("cvxfxs of userB: " +a));

    await operator.setFeeQueue(multisig,{from:deployer});
    console.log("set fee queue, fxs should accrue on " +multisig);

    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    await advanceTime(day);
    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    await operator.claimFees(feeDistro.address, fxs.address,{from:userB}).catch(a=>console.log("non claimer claimed: " +a));
    await operator.claimFees(feeDistro.address, fxs.address,{from:deployer});
    await fxs.balanceOf(operator.address).then(a=>console.log("fxs of operator: " +a));
    await fxs.balanceOf(multisig).then(a=>console.log("fxs of feeclaim: " +a));

    await advanceTime(day);
    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    await operator.claimFees(feeDistro.address, fxs.address,{from:userB}).catch(a=>console.log("non claimer claimed: " +a));
    await operator.claimFees(feeDistro.address, fxs.address,{from:deployer});
    await fxs.balanceOf(operator.address).then(a=>console.log("fxs of operator: " +a));
    await fxs.balanceOf(multisig).then(a=>console.log("fxs of feeclaim: " +a));

    await operator.setFeeQueue(addressZero,{from:deployer});
    console.log("remove fee queue, fxs should accrue on operator");

    await operator.setFeeClaimer(addressZero,{from:deployer});
    console.log("remove fee claimer");

    await advanceTime(day);
    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    console.log("claim with ungaurded call")
    await operator.claimFees(feeDistro.address, fxs.address,{from:userB});
    await fxs.balanceOf(operator.address).then(a=>console.log("fxs of operator: " +a));
    await fxs.balanceOf(multisig).then(a=>console.log("fxs of feeclaim: " +a));
    await advanceTime(day);
    await feeDistro.earned(voteproxy.address).then(a=>console.log("earned: " +a));
    await operator.claimFees(feeDistro.address, fxs.address,{from:deployer});
    var bal = await fxs.balanceOf(operator.address);
    console.log("fxs of operator: " +bal)
    
    //move fxs back to proxy and test rescue
    await operator.recoverERC20(fxs.address,bal,voteproxy.address,{from:deployer});
    await fxs.balanceOf(voteproxy.address).then(a=>console.log("fxs moved to voteproxy: " +a));
    await operator.recoverERC20FromProxy(fxs.address,bal,operator.address,{from:deployer})
    await fxs.balanceOf(operator.address).then(a=>console.log("fxs moved back to operator: " +a));

    //let vefxs decay a bit
    await escrow.locked__end(voteproxy.address).then(a=>console.log("lock end: " +a));
    await advanceTime(day*14);
    await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));
    await escrow.locked__end(voteproxy.address).then(a=>console.log("lock end: " +a));

    //withdraw and relock
    await operator.recoverERC20(fxs.address,bal,deployer,{from:deployer});
    console.log("withdraw");
    await fxs.balanceOf(operator.address).then(a=>console.log("fxs of operator: " +a));
    var bal = await fxs.balanceOf(deployer);
    console.log("fxs of owner: " +bal)
    await fxs.approve(fxsdeposit.address,0,{from:deployer});
    await fxs.approve(fxsdeposit.address,bal,{from:deployer});

    //advance time a day and relock for over 2 weeks to watch end time increase
    for(var i = 0; i < 22; i++){
      await fxsdeposit.deposit(1000,true,{from:deployer});
      console.log("re deposited");
      await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));
      await escrow.locked__end(voteproxy.address).then(a=>console.log("lock end: " +a));
      await advanceTime(day);
    }

    //decay all the way down
    for(var i = 0; i < 15; i++){
      await advanceTime(day*100);
      await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));
      await escrow.checkpoint();
    }

    await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));
    await escrow.locked(voteproxy.address).then(a=>console.log("fxs locked: " +a));
    
    //try to release and relock
    await fxsdeposit.initialLock({from:deployer});
    console.log("init locked again");
    await vefxs.balanceOf(voteproxy.address).then(a=>console.log("vefxs: " +a));
    await escrow.locked__end(voteproxy.address).then(a=>console.log("lock end: " +a));
  });
});


