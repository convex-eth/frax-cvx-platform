// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

    /** @notice
        There needs to be an immutable list of all Convex Vaults ever deployed for a given staking contract.
        This is because transfers from one vault to another:
          - must be verifiably convex vaults
          - may not originate from the same pool id
          - may not originate from the same booster or pool registry
          - but may still be staking to the same FraxFarm/Staking Contract
        Therefore, we need a siloed source of truth for looking up whether: 
          - both sender & receiver vault addresses are Convex Vaults
          - and that both sender & reciever stake assets to the same Farm/Staker

        TODO The booster OR the pool registry can activate a vault, in this scenario, the booster does it.
          - this should happen during vault creation
          - may be able to substitute this storage for the PoolRegistry's `vaultMap` to reduce unnecessary gas costs
          - the checks for whether a user has cloned a vault before should be deprecated to accommodate power users needing >1 vaults

        Due to the FraxFarm now having a limit to the number of active LockedStakes a given address can possess:
          - a user/vault owner may have any arbitrary number of vaults now to accommodate > `max_locked_stakes` positions
          - may have vault(s) from multiple pool id's that stake to the same FraxFarm/Staker
          - even if a poolID is deprecated & replaced with a new one, both old & new should show as valid Convex Vaults
    */

contract VaultRegistry {
    // farm -> owner -> vault -> bool
    mapping(address=>mapping(address=>mapping(address=>bool))) private stakerOwnerVaultMap;
    
    // a booster should be allowed to write this when vault is created
    // if booster is upgraded but the same farms are used, a new booster may need to be able to write to this
    // address public booster;
    mapping(address=>bool) public isBooster;

    address public owner;

    constructor() {//address _booster) {
        owner = msg.sender;
        // setBooster(_booster, true); // can do this after to use immutable vars to save users gas
    }

    function setBooster(address _booster, bool _isActive) public {
        require(msg.sender == owner, "!owner");
        isBooster[_booster] = _isActive;
    }

    //set the user's vault to true - this will always be a vault, so no need to be able to disable it
    function activateUserVault(address _staker, address _vaultOwner, address _vault) external {
        require(isBooster[msg.sender], "!booster");

        //enable the vault in storage
        stakerOwnerVaultMap[_staker][_vaultOwner][_vault] = true;
    }

    function isVault(address _staker, address _vaultOwner, address _vault) external view returns (bool) {
        return(stakerOwnerVaultMap[_staker][_vaultOwner][_vault]);
    }
}