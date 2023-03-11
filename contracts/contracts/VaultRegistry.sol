// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

    /** 
        @title Vaut Registry
        @author ZrowGz at Pitch Foundation for Convex
        @notice There needs to be an immutable list of all Convex Vaults ever deployed for a given staking contract.
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
    /// @notice Storage of all active transferrable Convex Vaults: farm -> owner -> vault -> bool
    mapping(address=>mapping(address=>mapping(address=>bool))) private stakerOwnerVaultMap;
    
    /// @notice Booster address -> booster state (true == allowed), activates vault during vault deployment/creation
    /// @dev if booster is upgraded but the same farm(s) are used, a new booster may need to be able to write to this as well
    mapping(address=>bool) public isBooster;

    /// @notice Owner grants permissions to boosters, which are able to activate vaults as belonging to the Convex Ecosystem
    address public owner;

    constructor() {//address _booster) {
        owner = msg.sender;
        // setBooster(_booster, true); // can do this after to use immutable vars to save users gas
    }

    /// @notice Allows owner to activate (or deactivate) boosters, granting the address permission
    /// @param _booster The address to grant permissions to
    /// @param _isActive The status of the _booster's permissions (true == active)
    function setBooster(address _booster, bool _isActive) public {
        require(msg.sender == owner, "!owner");
        isBooster[_booster] = _isActive;
    }

    /// @notice Set's the user's vault to true - this will always be a vault, so no need to be able to disable it
    /// @param _staker The FraxFarm staking contract address
    /// @param _vaultOwner The owner of the vault to activate
    /// @param _vault The address of the vault being deployed by a valid Convex Booster
    /// @dev Only callable by a registered Booster - todo could be changed to pool registry...
    function activateUserVault(address _staker, address _vaultOwner, address _vault) external {
        require(isBooster[msg.sender], "!booster");

        //enable the vault in storage
        stakerOwnerVaultMap[_staker][_vaultOwner][_vault] = true;
    }

    /// @notice Looks up whether a vault is active or not for a given vault owner within a given staking contract/frax farm
    /// @param _staker The FraxFarm staking contract address
    /// @param _vaultOwner The owner of the vault to look up
    /// @param _vault The address of the vault being verified as a valid Convex Vault
    /// @return bool True if it is a Convex ecosystem vault, False if it is not
    function isVault(address _staker, address _vaultOwner, address _vault) external view returns (bool) {
        return(stakerOwnerVaultMap[_staker][_vaultOwner][_vault]);
    }
}