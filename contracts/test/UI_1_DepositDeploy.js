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
    let voteproxy = await FraxVoterProxy.new();
    let cvxfxs = await cvxFxsToken.new();
    let fxsdeposit = await FxsDepositor.new(voteproxy.address, cvxfxs.address);
    let operator = await BoosterPlaceholder.new(voteproxy.address);

    await voteproxy.setDepositor(fxsdeposit.address);
    await voteproxy.setOperator(operator.address);
    await cvxfxs.setOperator(fxsdeposit.address);
    console.log("deployed");

     // //add to whitelist
    await walletChecker.approveWallet(voteproxy.address,{from:checkerAdmin,gasPrice:0});
    console.log("approved wallet");
    let isWhitelist = await walletChecker.check(voteproxy.address);
    console.log("is whitelist? " +isWhitelist);


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

    await fxsdeposit.initialLock();
    console.log("initial locked complete");
    
    contractList.system.voteProxy = voteproxy.address;
    contractList.system.cvxFxs = cvxfxs.address;
    contractList.system.fxsDepositor = fxsdeposit.address;
    contractList.system.booster = operator.address;
    jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });

    console.log("voteProxy: " +voteproxy.address);
    console.log("booster: " +operator.address);
    console.log("cvxFxs: " +cvxfxs.address);
    console.log("fxsDepositor: " +fxsdeposit.address);
  });
});


