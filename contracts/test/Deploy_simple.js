// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');


const GaugeExtraRewardDistributor = artifacts.require("GaugeExtraRewardDistributor");
const WrapperFactory = artifacts.require("WrapperFactory");
const StakingProxyConvex = artifacts.require("StakingProxyConvex");


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

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    // var distro = await GaugeExtraRewardDistributor.new({from:deployer});
    // console.log("fxs vault distro: " +distro.address);
    // var factory = await WrapperFactory.new({from:deployer})
    // console.log("factory: " +factory.address);

    var conveximpl = await StakingProxyConvex.new({from:deployer});
    console.log("convex impl: " +conveximpl.address);

    return;
  });
});


