// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');


const Booster = artifacts.require("Booster");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const IGovOmega = artifacts.require("IGovOmega");
const IGovDelegation = artifacts.require("IGovDelegation");


// -- for new ganache
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

contract("Deploy contracts", async accounts => {
  it("should deploy contracts", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    

    var newbooster = await Booster.new(contractList.system.voteProxy, contractList.system.poolRegistry, contractList.system.feeRegistry, {from:deployer});
    console.log("newbooster: " +newbooster.address);
    await newbooster.setPendingOwner(multisig,{from:deployer});

    // return;

    var oldbooster = await Booster.at(contractList.system.booster);
    console.log("oldbooster: " +oldbooster.address);
    var voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);

    await unlockAccount(multisig);
    await newbooster.acceptPendingOwner({from:multisig,gasPrice:0});
    await oldbooster.shutdownSystem({from:multisig,gasPrice:0})
    await voteproxy.setOperator(newbooster.address, {from:multisig,gasPrice:0});
    await voteproxy.operator().then(a=>console.log("proxy operator: " +a))
    console.log("set new booster")


    var govomega = await IGovOmega.at(contractList.frax.omega);
    var delegation = await IGovDelegation.at(contractList.frax.delegation);
    var proposal = "113360139851596377090341132147564434068634812291895622380384964228677626524055";
    var support = false;

    await govomega.hasVoted(proposal, contractList.system.voteProxy).then(a=>console.log("has voted yet? " +a))
    await newbooster.castVote(contractList.frax.omega, proposal, support, {from:deployer});
    await newbooster.castVote(contractList.frax.omega, proposal, support, {from:deployer}).catch(a=>console.log("revert already voted: " +a));
    console.log("vote cast!");
    await govomega.hasVoted(proposal, contractList.system.voteProxy).then(a=>console.log("has voted yet? " +a))

    await newbooster.voteDelegate().then(a=>console.log("booster vote delegate: " +a))
    await delegation.delegates(voteproxy.address).then(a=>console.log("vefxs delegation: " +a))
    await newbooster.setOnChainDelegate(delegation.address, multisig, {from:multisig,gasPrice:0});
    await newbooster.voteDelegate().then(a=>console.log("booster vote delegate: " +a))
    await delegation.delegates(voteproxy.address).then(a=>console.log("vefxs delegation: " +a))
    await unlockAccount(voteproxy.address);

    console.log("\n\n --  shutdown and recreate to test shutdown process --")
    var oldbooster = newbooster;
    var newbooster = await Booster.new(contractList.system.voteProxy, contractList.system.poolRegistry, contractList.system.feeRegistry, {from:deployer});
    console.log("newbooster: " +newbooster.address);
    console.log("oldbooster: " +oldbooster.address);
    await newbooster.setPendingOwner(multisig,{from:deployer});

    await unlockAccount(multisig);
    await newbooster.acceptPendingOwner({from:multisig,gasPrice:0});
    await oldbooster.shutdownSystem({from:multisig,gasPrice:0})
    await voteproxy.setOperator(newbooster.address, {from:multisig,gasPrice:0});
    await voteproxy.operator().then(a=>console.log("proxy operator: " +a))
    console.log("set new booster")
    return;
  });
});


