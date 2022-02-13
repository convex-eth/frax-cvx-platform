const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const BoosterPlaceholder = artifacts.require("BoosterPlaceholder");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");
const PoolRegistry = artifacts.require("PoolRegistry");
const FeeRegistry = artifacts.require("FeeRegistry");

const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");

const IFraxGaugeController = artifacts.require("IFraxGaugeController");


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

contract("Voting Tests", async accounts => {
  it("should successfully run", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    let fxs = await IERC20.at(contractList.frax.fxs);
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let vefxs = await IERC20.at(contractList.frax.vefxs);
    let feeDistro = await IFeeDistro.at(contractList.frax.vefxsRewardDistro);
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");

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

    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    let operator = await BoosterPlaceholder.at(contractList.system.booster);
    let controller = await IFraxGaugeController.at(contractList.frax.gaugeController);

    await operator.shutdownSystem({from:multisig, gasPrice:0});
    console.log("placeholder shutdown");


    //deply new booster
    let feeReg = await FeeRegistry.new();
    let poolReg = await PoolRegistry.new();
    let booster = await Booster.new(voteproxy.address, poolReg.address, feeReg.address);
    await booster.setOwner(multisig);
    console.log("new booster deployed: " +booster.address);

    await voteproxy.setOperator(booster.address,{from:multisig, gasPrice:0});
    console.log("voteproxy operator set to new booster");

    let somegauge = "0x3EF26504dbc8Dd7B7aa3E97Bc9f3813a9FC0B4B0";

    await controller.get_total_weight().then(a=>console.log("total weight: " +a))
    await controller.get_gauge_weight(somegauge).then(a=>console.log("gauge weight: " +a))
    var poolVoteInfo = await controller.vote_user_slopes(contractList.system.voteProxy,somegauge);
    console.log("user weight: " +poolVoteInfo[1]);

    await booster.voteGaugeWeight(controller.address, somegauge, 10000, {from:multisig, gasPrice:0});
    console.log("voted");

    await controller.get_total_weight().then(a=>console.log("total weight: " +a))
    await controller.get_gauge_weight(somegauge).then(a=>console.log("gauge weight: " +a))
    var poolVoteInfo = await controller.vote_user_slopes(contractList.system.voteProxy,somegauge);
    console.log("user weight: " +poolVoteInfo[1]);
  });
});


