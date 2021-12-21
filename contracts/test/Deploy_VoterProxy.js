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
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let vefxs = await IERC20.at(contractList.frax.vefxs);
    
    //deploy
    let voteproxy = await FraxVoterProxy.new({from:deployer});
    console.log("voteProxy: " +voteproxy.address);
    contractList.system.voteProxy = voteproxy.address;

    // let cvxfxs = await cvxFxsToken.new({from:deployer});
    // let fxsdeposit = await FxsDepositor.new(voteproxy.address, cvxfxs.address, {from:deployer});
    // let operator = await BoosterPlaceholder.new(voteproxy.address,{from:deployer});

    // await voteproxy.setDepositor(fxsdeposit.address,{from:deployer});
    // await voteproxy.setOperator(operator.address,{from:deployer});
    // await cvxfxs.setOperator(fxsdeposit.address,{from:deployer});
    // console.log("deployed");
    
    jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });
    
  });
});


