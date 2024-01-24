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


// -- for new ganache
const unlockAccount = async (address) => {
  await addAccount(address);
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "personal_unlockAccount",
        params: [address, "passphrase"],
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

const addAccount = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_addAccount",
        params: [address, "passphrase"],
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

contract("Deploy contracts", async accounts => {
  it("should deploy contracts", async () => {

    let deployer = contractList.system.deployer;
    let multisig = contractList.system.multisig;
    let addressZero = "0x0000000000000000000000000000000000000000"

    // var distro = await GaugeExtraRewardDistributor.new({from:deployer});
    // console.log("fxs vault distro: " +distro.address);
    // var factory = await WrapperFactory.new({from:deployer})
    // console.log("factory: " +factory.address);

    var conveximpl = await StakingProxyConvex.new({from:deployer});
    console.log("convex impl: " +conveximpl.address);
    var ercimpl = await StakingProxyERC20.new({from:deployer});
    console.log("ercimpl impl: " +ercimpl.address);

    // var feerec = await FeeReceiverCvxFxs.new(contractList.system.cvxfxsStaking, contractList.system.treasury, 500);
    // var feerec = await FeeReceiverPlatform.new();
    // console.log("feerec view: " +feerec.address);

    return;
  });
});


