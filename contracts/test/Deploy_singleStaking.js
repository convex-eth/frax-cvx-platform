const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const IERC20 = artifacts.require("IERC20");
const Booster = artifacts.require("Booster");
const cvxFxsStaking = artifacts.require("cvxFxsStaking");
const FeeDepositV2 = artifacts.require("FeeDepositV2");
const FeeReceiverCvxFxs = artifacts.require("FeeReceiverCvxFxs");
const ICvxDistribution = artifacts.require("ICvxDistribution");


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
const mineMultiBlock = (blockCnt) => send({ method: 'evm_mine', options:{blocks:blockCnt } });
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

  // await mineBlock();
  await mineMultiBlock(1000);
};

const advanceTime = async (secondsElaspse) => {
  await time.increase(secondsElaspse);
  await time.advanceBlock();
  console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
}
const day = 86400;


contract("deploy staking contracts", async accounts => {
  it("should successfully deploy", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    let fxs = await IERC20.at(contractList.frax.fxs);
    let cvx = await IERC20.at(contractList.system.cvx);
    let cvxfxs = await IERC20.at(contractList.system.cvxFxs);
    
    let booster = await Booster.at(contractList.system.booster);
    let feeDeposit = await FeeDepositV2.at(contractList.system.feeDepositV2);

    let staking = await cvxFxsStaking.new({from:deployer});
    console.log("cvxfxs staking: " +staking.address);
    contractList.system.cvxfxsStaking = staking.address;
    let feerec = await FeeReceiverCvxFxs.new(staking.address,{from:deployer})
    console.log("fee receiver: " +feerec.address);
    contractList.system.feeReceiverCvxFxs = feerec.address;

    jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });

    await staking.addReward(fxs.address,feerec.address,{from:deployer});
    await staking.addReward(cvx.address,feerec.address,{from:deployer});
    console.log("added fxs and cvx as reward tokens");

    let cvxdistro = await ICvxDistribution.at(contractList.system.cvxDistro);
    await cvxdistro.setWeight("0x4f3AD55D7b884CDC48ADD1e2451A13af17887F26",0,{from:deployer}); //remove lp direct
    await cvxdistro.setWeight(feerec.address,500,{from:deployer}); //move to single staking
    console.log("set cvx weight")

    await staking.rewardData(fxs.address).then(a=>console.log("reward data fxs: " +JSON.stringify(a)));
    await staking.rewardData(cvx.address).then(a=>console.log("reward data cvx: " +JSON.stringify(a)));

    // ---  msig txs etc and testing ---
    await unlockAccount(multisig);

    await booster.setFeeQueue(feerec.address,{from:multisig,gasPrice:0});
    console.log("vefxs revenue redirected to fee receiver");
    
    await feeDeposit.setCvxFxsReceiver(feerec.address,true,{from:multisig,gasPrice:0});
    console.log("directed feedeposit cvxfxs rewards to fee receiver");

    await advanceTime(4 * day);
    await fxs.balanceOf(feeDeposit.address).then(a=>console.log("fxs on fee deposit: " +a))
    await feeDeposit.distribute({from:deployer});
    console.log("distributed");

    await staking.rewardData(fxs.address).then(a=>console.log("reward data fxs: " +JSON.stringify(a)));
    await staking.rewardData(cvx.address).then(a=>console.log("reward data cvx: " +JSON.stringify(a)));


    let tokenholder = "0xd658A338613198204DCa1143Ac3F01A722b5d94A";
    await unlockAccount(tokenholder);
    await cvxfxs.transfer(accounts[0],web3.utils.toWei("100000.0", "ether"),{from:tokenholder,gasPrice:0});
    await fxs.transfer(accounts[0],web3.utils.toWei("100000.0", "ether"),{from:tokenholder,gasPrice:0});
    await cvxfxs.balanceOf(accounts[0]).then(a=>console.log("transfered cvxfxs: " +a));
    await fxs.balanceOf(accounts[0]).then(a=>console.log("transfered fxs: " +a));
    
  });
});


