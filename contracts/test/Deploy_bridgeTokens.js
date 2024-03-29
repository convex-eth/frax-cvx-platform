// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const FraxtalVoterProxy = artifacts.require("FraxtalVoterProxy");
const FraxtalBooster = artifacts.require("FraxtalBooster");
// const ProxyFactory = artifacts.require("ProxyFactory");
const cvxToken = artifacts.require("cvxToken");
const IConvexSideBooster = artifacts.require("IConvexSideBooster");

const IERC20 = artifacts.require("IERC20");
const ERC20 = artifacts.require("ERC20");


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

contract("Deploy bridge tokens", async accounts => {
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

    console.log("\n\n >>>> deploy system >>>>")

    //deploy cvx
    // var mainnet = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";
    // var curevvoteproxy = "0x989AEb4d175e16225E39E87d0D97A3360524AD80"
    // var token = await cvxToken.new("Convex Token","CVX",curevvoteproxy,mainnet,chainContracts.frax.bridge,{from:deployer});
    // chainContracts.system.cvx = token.address;
    // console.log("cvx: " +token.address);
    // await token.owner().then(a=>console.log("owner: " +a))
    // await token.name().then(a=>console.log("name: " +a))
    // await token.symbol().then(a=>console.log("symbol: " +a))
    // var booster = await IConvexSideBooster.at("0xd3327cb05a8E0095A543D582b5B3Ce3e19270389");
    // await booster.setTokenMinterOperator(token.address,chainContracts.frax.bridge,true,{from:deployer});
    // console.log("bridge given mint role")
    // await token.operators(chainContracts.frax.bridge).then(a=>console.log("bridge is operator? " +a));

    //deploy cvxcrv
    var mainnet = "0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7";
    var curevvoteproxy = "0x989AEb4d175e16225E39E87d0D97A3360524AD80"
    var token = await cvxToken.new("Convex CRV","cvxCRV",curevvoteproxy,mainnet,chainContracts.frax.bridge,{from:deployer});
    chainContracts.system.cvxCrv = token.address;
    console.log("cvxCrv: " +token.address);
    await token.owner().then(a=>console.log("owner: " +a))
    await token.name().then(a=>console.log("name: " +a))
    await token.symbol().then(a=>console.log("symbol: " +a))
    var booster = await IConvexSideBooster.at("0xd3327cb05a8E0095A543D582b5B3Ce3e19270389");
    await booster.setTokenMinterOperator(token.address,chainContracts.frax.bridge,true,{from:deployer});
    console.log("bridge given mint role")
    await token.operators(chainContracts.frax.bridge).then(a=>console.log("bridge is operator? " +a));

    //deploy cvxfpis
    var mainnetfpis = "0xa2847348b58CEd0cA58d23c7e9106A49f1427Df6";
    var cvxfpis = await cvxToken.new("Convex FPIS","cvxFPIS",voteproxy,mainnetfpis,chainContracts.frax.bridge,{from:deployer});
    chainContracts.system.cvxFpis = cvxfpis.address;
    console.log("cvxFpis: " +cvxfpis.address);
    await cvxfpis.owner().then(a=>console.log("cvxfpis owner: " +a))
    await cvxfpis.name().then(a=>console.log("cvxfpis name: " +a))
    await cvxfpis.symbol().then(a=>console.log("cvxfpis symbol: " +a))
    var booster = await FraxtalBooster.at(chainContracts.system.fpisBooster);
    var minterdata = cvxfpis.contract.methods.setOperator(chainContracts.frax.bridge,true).encodeABI();
    console.log(minterdata);
    await booster.execute(cvxfpis.address, minterdata, {from:deployer});
    console.log("bridge given mint role")
    await cvxfpis.operators(chainContracts.frax.bridge).then(a=>console.log("bridge is operator? " +a));

    var mainnet = "0xFEEf77d3f69374f66429C91d732A244f074bdf74";
    var token = await cvxToken.new("Convex FXS","cvxFXS",chainContracts.system.voteProxy,mainnet,chainContracts.frax.bridge,{from:deployer});
    chainContracts.system.cvxFxs = token.address;
    console.log("cvxFxs: " +token.address);
    await token.owner().then(a=>console.log("owner: " +a))
    await token.name().then(a=>console.log("name: " +a))
    await token.symbol().then(a=>console.log("symbol: " +a))
    var booster = await FraxtalBooster.at(chainContracts.system.booster);
    var minterdata = token.contract.methods.setOperator(chainContracts.frax.bridge,true).encodeABI();
    console.log(minterdata);
    await booster.execute(token.address, minterdata, {from:deployer});
    console.log("bridge given mint role")
    await token.operators(chainContracts.frax.bridge).then(a=>console.log("bridge is operator? " +a));
    
    console.log("\n\n --- deployed ----");

    console.log(chainContracts);
    if(config.network == "debugFraxtal" || config.network == "mainnetFraxtal"){
      contractList.fraxtal = chainContracts;
    }
    jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });

    return;
  });
});


