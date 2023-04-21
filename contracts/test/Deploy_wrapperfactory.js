// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');


const GaugeExtraRewardDistributor = artifacts.require("GaugeExtraRewardDistributor");
const WrapperFactory = artifacts.require("WrapperFactory");
const IConvexWrapperV2 = artifacts.require("IConvexWrapperV2");


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
    var factory = await WrapperFactory.at(contractList.system.fraxWrapperFactory)
    console.log("factory: " +factory.address);

    var fraximp = "0x6De275fc3cE59976e9f5FBbAb31523CB5942766E";

    await factory.setImplementation(fraximp,{from:deployer});
    await factory.wrapperImplementation().then(a=>console.log("imp: " +a))

    return;

    let clonec = await factory.CreateWrapper.call(100,{from:deployer});
    console.log("wrapper: " +clonec);
    let clonetx = await factory.CreateWrapper(100,{from:deployer});
    console.log(clonetx);

    var wrapper = await IConvexWrapperV2.at(clonec);
    await wrapper.convexPoolId().then(a=>console.log("convexPoolId: " +a))
    await wrapper.curveToken().then(a=>console.log("curveToken: " +a))
    await wrapper.convexToken().then(a=>console.log("convexToken: " +a))

    return;
  });
});


