const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");
const StakingProxyERC20 = artifacts.require("StakingProxyERC20");
const IFraxFarmERC20 = artifacts.require("IFraxFarmERC20");
const PoolRegistry = artifacts.require("PoolRegistry");
const FeeRegistry = artifacts.require("FeeRegistry");
const MultiRewards = artifacts.require("MultiRewards");
const PoolUtilities = artifacts.require("PoolUtilities");

const IVPool = artifacts.require("IVPool");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");

const IFraxGaugeController = artifacts.require("IFraxGaugeController");

const ICurveConvex = artifacts.require("ICurveConvex");


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

contract("Proxy Check", async accounts => {
  it("pools should have our proxy whitelisted", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    var poolList = contractList.pools;

    for(const pool of poolList){
      if(pool.id < 2) continue;
      if(pool.id == 8) continue; //skip temple
      console.log("pool: " +pool.name);
      var farm = await IFraxFarmERC20.at(pool.stakingAddress);
      var proxy = await farm.getProxyFor(contractList.system.voteProxy);
      //.then(a=>console.log("proxy: " +a));
      console.log("proxy: " +proxy);
      if(proxy == addressZero){
        console.log("    -->  Proxy not set!!");
      }
    }

    // var farm = await IFraxFarmERC20.at("0x963f487796d54d2f27bA6F3Fbe91154cA103b199");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));

    // farm = await IFraxFarmERC20.at("0x560c7668459221e33ED515D1D17c09ECda1996f5");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));
    
    // farm = await IFraxFarmERC20.at("0xF0A9b6F6593b4Bf96E1Ab13921A8a3FbFd9d4F16");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));

    // farm = await IFraxFarmERC20.at("0xa810D1268cEF398EC26095c27094596374262826");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));

    // farm = await IFraxFarmERC20.at("0xF0Ffe16810B7f412c52C1610e3BC9819A7Dcb366");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));

    // farm = await IFraxFarmERC20.at("0xaCf54f101B86f9e55d35C0674Ebd8C854E5f80e4");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));

    // farm = await IFraxFarmERC20.at("0x711d650Cd10dF656C2c28D375649689f137005fA");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));

    // farm = await IFraxFarmERC20.at("0xF7242A1cE383174802818febB36B6eebb56d5BFb");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));

    // farm = await IFraxFarmERC20.at("0xb324b2BD8a3Dc55b04111E84d5cce0c3771F8889");
    // await farm.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check " +farm.address +": " +a));

  });
});


