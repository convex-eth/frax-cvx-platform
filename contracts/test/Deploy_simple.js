// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');


const GaugeExtraRewardDistributor = artifacts.require("GaugeExtraRewardDistributor");
const WrapperFactory = artifacts.require("WrapperFactory");
const StakingProxyConvex = artifacts.require("StakingProxyConvex");
const StakingProxyERC20 = artifacts.require("StakingProxyERC20");
const VaultEarnedView = artifacts.require("VaultEarnedView");
const FeeReceiverCvxFxs = artifacts.require("FeeReceiverCvxFxs");
const FeeReceiverPlatform = artifacts.require("FeeReceiverPlatform");
const FeeBridge = artifacts.require("FeeBridge");
const FeeReceiverVeFxs = artifacts.require("FeeReceiverVeFxs");

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

contract("Deploy contracts", async accounts => {
  it("should deploy contracts", async () => {

    let deployer = contractList.system.deployer;
    let multisig = contractList.system.multisig;
    let addressZero = "0x0000000000000000000000000000000000000000"
    await unlockAccount(deployer);
    // var distro = await GaugeExtraRewardDistributor.new({from:deployer});
    // console.log("fxs vault distro: " +distro.address);
    // var factory = await WrapperFactory.new({from:deployer})
    // console.log("factory: " +factory.address);

    // var conveximpl = await StakingProxyConvex.new({from:deployer});
    // console.log("convex impl: " +conveximpl.address);
    // var ercimpl = await StakingProxyERC20.new({from:deployer});
    // console.log("ercimpl impl: " +ercimpl.address);

    // var feerec = await FeeReceiverCvxFxs.new(contractList.system.cvxfxsStaking, contractList.system.treasury, 500);
    // var feerec = await FeeReceiverPlatform.new();
    // console.log("feerec view: " +feerec.address);

    //address _bridge, address _l1token, address _l2token, address _l2receiver, uint256 _share, address _returnAddress
    // var bridge = contractList.frax.fraxtalBridge;
    // var l1token = contractList.frax.fxs;
    // var l2token = contractList.fraxtal.frax.fxs;
    // var receiver = contractList.fraxtal.system.bridgeReceiver;
    // var returnaddress = contractList.system.feeReceiverCvxFxs;
    // var feebridge = await FeeBridge.new(bridge, l1token, l2token, receiver, 500, returnaddress, {from:deployer});
    // console.log("feebridge: " +feebridge.address);

    var vefxsfee = await FeeReceiverVeFxs.new(contractList.system.feeBridge, contractList.system.treasury, 500, {from:deployer});
    console.log("vefxs fees " +vefxsfee.address);

    return;
  });
});


