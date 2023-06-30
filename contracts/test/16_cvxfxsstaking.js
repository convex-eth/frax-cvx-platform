const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");
const TestPool_Erc20 = artifacts.require("TestPool_Erc20");
const StakingProxyERC20 = artifacts.require("StakingProxyERC20");
const StakingProxyConvex = artifacts.require("StakingProxyConvex");
const IFraxFarmERC20 = artifacts.require("IFraxFarmERC20");
const PoolRegistry = artifacts.require("PoolRegistry");
const FeeRegistry = artifacts.require("FeeRegistry");
const MultiRewards = artifacts.require("MultiRewards");
const PoolUtilities = artifacts.require("PoolUtilities");
const IConvexWrapper = artifacts.require("IConvexWrapper");
const ICvxLocker = artifacts.require("ICvxLocker");
const FeeDeposit = artifacts.require("FeeDeposit");
const FeeDepositV2 = artifacts.require("FeeDepositV2");
const FeeReceiverVlCvx = artifacts.require("FeeReceiverVlCvx");
const IERC20 = artifacts.require("IERC20");
const IConvexWrapperV2 = artifacts.require("IConvexWrapperV2");
const VaultEarnedView = artifacts.require("VaultEarnedView");
const cvxFxsStaking = artifacts.require("cvxFxsStaking");
const FeeReceiverCvxFxs = artifacts.require("FeeReceiverCvxFxs");


const ICurveConvex = artifacts.require("ICurveConvex");


// const unlockAccount = async (address) => {
//   return new Promise((resolve, reject) => {
//     web3.currentProvider.send(
//       {
//         jsonrpc: "2.0",
//         method: "evm_unlockUnknownAccount",
//         params: [address],
//         id: new Date().getTime(),
//       },
//       (err, result) => {
//         if (err) {
//           return reject(err);
//         }
//         return resolve(result);
//       }
//     );
//   });
// };

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

contract("Update fee deposit", async accounts => {
  it("should run successfully", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    let frax = await IERC20.at(contractList.frax.frax);
    let fxs = await IERC20.at(contractList.frax.fxs);
    let vefxs = await IERC20.at(contractList.frax.vefxs);
    let crv = await IERC20.at(contractList.system.crv);
    let cvx = await IERC20.at(contractList.system.cvx);
    let cvxfxs = await IERC20.at(contractList.system.cvxFxs);

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

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

   

    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    var booster = await Booster.at(contractList.system.booster);
   
    let staking = await cvxFxsStaking.at(contractList.system.cvxfxsStaking);
    let feerec = await FeeReceiverCvxFxs.new(staking.address,{from:deployer})
    let feeDeposit = await FeeDepositV2.at(contractList.system.feeDepositV2);
    
    // await cvx.balanceOf(owner).then(a=>console.log("cvx on wallet: " +a))

    //get crv and cvxcrv
    // var cvxfxsholder = "0xd658A338613198204DCa1143Ac3F01A722b5d94A";
    // var fxsholder = "0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0";

    // await unlockAccount(cvxfxsholder);
    // await unlockAccount(fxsholder);
    // await cvxfxs.transfer(userA,web3.utils.toWei("100000.0", "ether"),{from:cvxfxsholder,gasPrice:0});
    // await fxs.transfer(userA,web3.utils.toWei("100000.0", "ether"),{from:fxsholder,gasPrice:0});
    // console.log("receive fxs and cvxfxs");
    let tokenholder = "0xd658A338613198204DCa1143Ac3F01A722b5d94A";
    await unlockAccount(tokenholder);
    await cvxfxs.transfer(accounts[0],web3.utils.toWei("100000.0", "ether"),{from:tokenholder,gasPrice:0});
    await fxs.transfer(accounts[0],web3.utils.toWei("100000.0", "ether"),{from:tokenholder,gasPrice:0});
    await cvxfxs.balanceOf(accounts[0]).then(a=>console.log("transfered cvxfxs: " +a));
    await fxs.balanceOf(accounts[0]).then(a=>console.log("transfered fxs: " +a));
    await advanceTime(4 * day);
    await fxs.balanceOf(feeDeposit.address).then(a=>console.log("fxs on fee deposit: " +a))
    await feeDeposit.distribute({from:deployer});
    console.log("distributed");


    //stake/deposit/deposit with lock
    await cvxfxs.approve(staking.address,web3.utils.toWei("10000000000.0", "ether"));
    await fxs.approve(staking.address,web3.utils.toWei("10000000000.0", "ether"));
    console.log("approved");

    await staking.stake(web3.utils.toWei("50000.0", "ether"));
    await staking.balanceOf(userA).then(a=>console.log("staked, balanceA: " +a))
    await staking.stakeFor(userB, web3.utils.toWei("50000.0", "ether"));
    await staking.balanceOf(userB).then(a=>console.log("stake for B, balanceB: " +a))

    await fxs.balanceOf(contractList.system.fxsDepositor).then(a=>console.log("fxs on depositor: " +a))
    await staking.deposit(web3.utils.toWei("50000.0", "ether"));
    console.log("deposited with no lock")
    await fxs.balanceOf(contractList.system.fxsDepositor).then(a=>console.log("fxs on depositor: " +a))
    await staking.deposit(web3.utils.toWei("50000.0", "ether"), true);
    console.log("deposited with lock")
    await fxs.balanceOf(contractList.system.fxsDepositor).then(a=>console.log("fxs on depositor: " +a))

    //checkpoints/earned/claim/redirect
    await advanceTime(day);
    await staking.claimableRewards(userA).then(a=>console.log("earned A: " +JSON.stringify(a)))
    await staking.claimableRewards(userB).then(a=>console.log("earned B: " +JSON.stringify(a)))

    await staking.setRewardRedirect(userC,{from:userB});
    console.log("redirect set");
    await staking.rewardRedirect(userA).then(a=>console.log("redirect A: " +a))
    await staking.rewardRedirect(userB).then(a=>console.log("redirect B: " +a))

    await staking.methods['getReward(address)'](userA,{from:userA});
    console.log("claimed");
    await staking.methods['getReward(address)'](userB,{from:userC});
    console.log("claimed unguarded")

    await fxs.balanceOf(userA).then(a=>console.log("fxs balance A: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("cvx balance A: " +a))
    await fxs.balanceOf(userB).then(a=>console.log("fxs balance B: " +a))
    await cvx.balanceOf(userB).then(a=>console.log("cvx balance B: " +a))
    await fxs.balanceOf(userC).then(a=>console.log("fxs balance C: " +a))
    await cvx.balanceOf(userC).then(a=>console.log("cvx balance C: " +a))

    await advanceTime(day/2);

    await staking.getReward(userA, userB, {from:userA});
    console.log("claimed a to b");
    await staking.getReward(userB, userD, {from:userC}).catch(a=>console.log("revert forward not self: " +a));

    await fxs.balanceOf(userA).then(a=>console.log("fxs balance A: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("cvx balance A: " +a))
    await fxs.balanceOf(userB).then(a=>console.log("fxs balance B: " +a))
    await cvx.balanceOf(userB).then(a=>console.log("cvx balance B: " +a))
    await fxs.balanceOf(userC).then(a=>console.log("fxs balance C: " +a))
    await cvx.balanceOf(userC).then(a=>console.log("cvx balance C: " +a))

    await advanceTime(day/2);

    //transfer
    await staking.balanceOf(userB).then(a=>console.log("user B staked: " +a))
    await staking.balanceOf(userD).then(a=>console.log("user D staked: " +a))
    await staking.claimableRewards(userB).then(a=>console.log("earned B: " +JSON.stringify(a)))
    await staking.claimableRewards(userD).then(a=>console.log("earned D: " +JSON.stringify(a)))

    await staking.transfer(userD,web3.utils.toWei("50000.0", "ether"),{from:userB});
    console.log("transfered")
    await staking.balanceOf(userB).then(a=>console.log("user B staked: " +a))
    await staking.balanceOf(userD).then(a=>console.log("user D staked: " +a))

    await advanceTime(day);
    await staking.claimableRewards(userB).then(a=>console.log("earned B: " +JSON.stringify(a)))
    await staking.claimableRewards(userD).then(a=>console.log("earned D: " +JSON.stringify(a)))



    await advanceTime(day*8);
    console.log("rewards ended");
    await staking.methods['getReward(address)'](userA);
    await staking.methods['getReward(address)'](userB);
    await staking.methods['getReward(address)'](userC);
    await staking.methods['getReward(address)'](userD);
    console.log("all claimed");

    await fxs.balanceOf(staking.address).then(a=>console.log("fxs left on staking: " +a))
    await cvx.balanceOf(staking.address).then(a=>console.log("cvx left on staking: " +a))
    await fxs.balanceOf(userA).then(a=>console.log("fxs balance A: " +a))
    await fxs.balanceOf(userB).then(a=>console.log("fxs balance B: " +a))
    await fxs.balanceOf(userC).then(a=>console.log("fxs balance C: " +a))
    await fxs.balanceOf(userD).then(a=>console.log("fxs balance D: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("cvx balance A: " +a))
    await cvx.balanceOf(userB).then(a=>console.log("cvx balance B: " +a))
    await cvx.balanceOf(userC).then(a=>console.log("cvx balance C: " +a))
    await cvx.balanceOf(userD).then(a=>console.log("cvx balance D: " +a))

    //admin commands: add/remove distro, add tokens, recover
    await staking.approveRewardDistributor(crv.address, deployer, false, {from:userA}).catch(a=>console.log("revert not owner: "+a))
    await staking.addReward(crv.address, deployer, {from:userA}).catch(a=>console.log("revert not owner: "+a))
    await staking.addReward(cvxfxs.address, deployer, {from:deployer}).catch(a=>console.log("revert dont add cvxfxs: "+a))
    await staking.addReward(staking.address, deployer, {from:deployer}).catch(a=>console.log("revert dont add self: "+a))
    await staking.addReward(fxs.address, deployer, {from:deployer}).catch(a=>console.log("revert already added: "+a))

    var crvholder = "0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2";
    await unlockAccount(crvholder);
    await crv.transfer(staking.address,web3.utils.toWei("100000.0", "ether"),{from:crvholder,gasPrice:0});
    var crvbal = await crv.balanceOf(staking.address);
    console.log("crv on staking address needs rescue: " +crvbal);
    await crv.balanceOf(deployer).then(a=>console.log("crv on rescue manager: " +a));
    await staking.recoverERC20(crv.address, crvbal, {from:userA}).catch(a=>console.log("revert not reward manager: " +a))
    await staking.recoverERC20(cvx.address, web3.utils.toWei("1.0", "ether"), {from:deployer}).catch(a=>console.log("revert cant rescue rewards: " +a))
    await staking.recoverERC20(cvxfxs.address, web3.utils.toWei("1.0", "ether"), {from:deployer}).catch(a=>console.log("revert cant rescue staking token: " +a))
    await staking.recoverERC20(crv.address, crvbal, {from:deployer});
    console.log("rescue called");
    await crv.balanceOf(staking.address).then(a=>console.log("crv on staking address: " +a));
    await crv.balanceOf(deployer).then(a=>console.log("crv on rescue manager: " +a));
    
    //add too much check
    var somenewtoken = await cvxFxsToken.new();
    await somenewtoken.mint(deployer,web3.utils.toWei("1000000000000000000000000000000000.0", "ether"));
    console.log("minted a lot of tokens");
    await somenewtoken.approve(staking.address, web3.utils.toWei("1000000000000000000000000000000000.0", "ether"), {from:deployer});
    await staking.addReward(somenewtoken.address, deployer, {from:deployer});
    console.log("added new token");
    await staking.notifyRewardAmount(somenewtoken.address, web3.utils.toWei("1000000000000000000000000000000000.0", "ether"), {from:deployer} ).catch(a=>console.log("reward add too much revert: " +a));
    await staking.notifyRewardAmount(somenewtoken.address, web3.utils.toWei("100000000000000000000000.0", "ether"), {from:deployer} ).catch(a=>console.log("reward add too much revert: " +a));
    await staking.notifyRewardAmount(somenewtoken.address, web3.utils.toWei("100000000000.0", "ether"), {from:userA} ).catch(a=>console.log("reward add not distrib role: " +a));
    await staking.notifyRewardAmount(somenewtoken.address, web3.utils.toWei("100000000000.0", "ether"), {from:deployer} )
    console.log("reward notified with legit amount");
    await somenewtoken.balanceOf(staking.address).then(a=>console.log("token on staking: " +a));


    //withdraw
    var userABal = await staking.balanceOf(userA)
    var userBBal = await staking.balanceOf(userB)
    var userCBal = await staking.balanceOf(userC)
    var userDBal = await staking.balanceOf(userD)
    await staking.withdraw(userABal,{from:userA});
    console.log("withdraw A")
    await staking.withdraw(userBBal,{from:userB}).catch(a=>console.log("revert, no balance on B: " +a));
    await staking.withdraw(userCBal,{from:userC}).catch(a=>console.log("revert, no balance on C: " +a));
    await staking.withdraw(userDBal,{from:userD});
    console.log("withdraw D")

    await staking.balanceOf(userA).then(a=>console.log("staking balance A: " +a))
    await staking.balanceOf(userB).then(a=>console.log("staking balance B: " +a))
    await staking.balanceOf(userC).then(a=>console.log("staking balance C: " +a))
    await staking.balanceOf(userD).then(a=>console.log("staking balance D: " +a))
    await cvxfxs.balanceOf(userA).then(a=>console.log("cvxfxs balance A: " +a))
    await cvxfxs.balanceOf(userB).then(a=>console.log("cvxfxs balance B: " +a))
    await cvxfxs.balanceOf(userC).then(a=>console.log("cvxfxs balance C: " +a))
    await cvxfxs.balanceOf(userD).then(a=>console.log("cvxfxs balance D: " +a))
  });
});


