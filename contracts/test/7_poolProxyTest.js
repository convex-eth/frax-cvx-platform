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

contract("Vault Tests", async accounts => {
  it("should successfully run", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"


    let vesper = await IFraxFarmERC20.at("0x698137C473bc1F0Ea9b85adE45Caf64ef2DF48d6");
    // await vesper.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check vesper: " +a));
    let temple = await IFraxFarmERC20.at("0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16");
    // await temple.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check temple: " +a));
    let afrax = await IFraxFarmERC20.at("0x02577b426F223A6B4f2351315A19ecD6F357d65c");
    await afrax.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check afrax: " +a));
    let fpi = await IFraxFarmERC20.at("0x0a08673E3d7c454E1c6b27acD059C50Df6727FC9");
    await fpi.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check fpi: " +a));
    
    let fraxbp = await IFraxFarmERC20.at("0x963f487796d54d2f27bA6F3Fbe91154cA103b199");
    await fraxbp.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check fraxbp: " +a));
    
  });
});


