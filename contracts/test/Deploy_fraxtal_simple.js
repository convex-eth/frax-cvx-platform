// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const FraxtalVoterProxy = artifacts.require("FraxtalVoterProxy");
const FraxtalBooster = artifacts.require("FraxtalBooster");
// const ProxyFactory = artifacts.require("ProxyFactory");
const cvxToken = artifacts.require("cvxToken");
const IConvexSideBooster = artifacts.require("IConvexSideBooster");
const BridgeReceiver = artifacts.require("BridgeReceiver");
const RewardDistribution = artifacts.require("RewardDistribution");
const FraxtalPoolUtilities = artifacts.require("FraxtalPoolUtilities");
const cvxFXBRateCalc = artifacts.require("cvxFXBRateCalc");
const cvxFXB = artifacts.require("cvxFXB");
const IFraxLend = artifacts.require("IFraxLend");

const IERC20 = artifacts.require("IERC20");
const ERC20 = artifacts.require("ERC20");
const IERC4626 = artifacts.require("IERC4626");


const unlockAccount = async (address) => {
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "hardhat_impersonateAccount",
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

const setNoGas = async () => {
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "hardhat_setNextBlockBaseFeePerGas",
        params: ["0x0"],
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

const send = payload => {
  if (!payload.jsonrpc) payload.jsonrpc = '2.0';
  if (!payload.id) payload.id = new Date().getTime();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(payload, (error, result) => {
      if (error) return reject(error);

      return resolve(result);
    });
  });
};

/**
 *  Mines a single block in Ganache (evm_mine is non-standard)
 */
const mineBlock = () => send({ method: 'evm_mine' });

/**
 *  Gets the time of the last block.
 */
const currentTime = async () => {
  const { timestamp } = await web3.eth.getBlock('latest');
  return timestamp;
};

/**
 *  Increases the time in the EVM.
 *  @param seconds Number of seconds to increase the time by
 */
const fastForward = async seconds => {
  // It's handy to be able to be able to pass big numbers in as we can just
  // query them from the contract, then send them back. If not changed to
  // a number, this causes much larger fast forwards than expected without error.
  if (BN.isBN(seconds)) seconds = seconds.toNumber();

  // And same with strings.
  if (typeof seconds === 'string') seconds = parseFloat(seconds);

  await send({
    method: 'evm_increaseTime',
    params: [seconds],
  });

  await mineBlock();
};

const getChainContracts = () => {
  let NETWORK = config.network;//process.env.NETWORK;
  console.log("network: " +NETWORK);
  var contracts = {};

  if(NETWORK == "debugFraxtal" || NETWORK == "mainnetFraxtal"){
    contracts = contractList.fraxtal;
  }

  return contracts;
}

const advanceTime = async (secondsElaspse) => {
  await fastForward(secondsElaspse);
  console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
}
const day = 86400;

contract("Deploy simple contracts", async accounts => {
  it("should deploy contracts and test various functions", async () => {

    let chainContracts = getChainContracts();
    let deployer = chainContracts.system.deployer;
    let multisig = chainContracts.system.multisig;
    let addressZero = "0x0000000000000000000000000000000000000000"
    let voteproxy = "0xf3BD66ca9b2b43F6Aa11afa6F4Dfdc836150d973";

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

    
    await unlockAccount(deployer);

    console.log("\n\n >>>> deploy >>>>")

    // var br = await BridgeReceiver.new(chainContracts.system.voteProxy);
    // console.log("bridge receiver " +br.address);
    // chainContracts.system.bridgeReceiver = br.address;
    // await br.operator().then(a=>console.log("op " +a))

    // var rd = await RewardDistribution.new(chainContracts.frax.fxs,chainContracts.system.voteProxy,{from:deployer});
    // console.log("distro " +rd.address);
    // chainContracts.system.rewardDistribution = rd.address;
    
    
    // var util = await FraxtalPoolUtilities.new({from:deployer});
    // console.log("util " +util.address);
    // chainContracts.system.poolUtility = util.address;
    // await util.stakedCvxFxsRewardRates().then(a=>console.log(JSON.stringify(a)));


    //update cvxfxb operator
    var fraxlend = await IFraxLend.at("0x3e92765eE2B009b104A8A7baf3759B159c19AbA1");
    var frax = await IERC20.at(chainContracts.frax.frax);
    var sfraxVault = await IERC4626.at(chainContracts.frax.sfraxVault);
    var cvxfxb = await cvxFXB.at(chainContracts.system.cvxfxb);
    var cvxfxbRates = await cvxFXBRateCalc.new(cvxfxb.address, frax.address, sfraxVault.address, fraxlend.address, {from:deployer})
    await cvxfxb.setOperator(cvxfxbRates.address,{from:deployer})
    console.log("rates: " +cvxfxbRates.address);
    chainContracts.system.cvxfxbOperator = cvxfxbRates.address;

    await cvxfxbRates.currentRatesPerSupply().then(a=>console.log("current rate per supply: " +a))

    console.log("\n\n --- deployed ----");

    console.log(chainContracts);
    if(config.network == "mainnetFraxtal"){
      contractList.fraxtal = chainContracts;
      jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });
    }

    return;
  });
});


