// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IFraxLend {
   struct VaultAccount {
       uint128 amount; // Total amount, analogous to market cap
       uint128 shares; // Total shares, analogous to shares outstanding
   }

   struct CurrentRateInfo {
        uint32 lastBlock;
        uint32 feeToProtocolRate; // Fee amount 1e5 precision
        uint64 lastTimestamp;
        uint64 ratePerSec;
        uint64 fullUtilizationRate;
    }

   struct ExchangeRateInfo {
        address oracle;
        uint32 maxOracleDeviation; // % of larger number, 1e5 precision
        uint184 lastTimestamp;
        uint256 lowExchangeRate;
        uint256 highExchangeRate;
    }

   function collateralContract() external view returns(address);
   function toBorrowAmount(
        uint256 _shares,
        bool _roundUp,
        bool _previewInterest
    ) external view returns (uint256 _amount);
   function totalBorrow() external view returns(uint256 assets, uint256 shares);
   function totalAsset() external view returns(uint256 assets, uint256 shares);
   function totalAssets() external view returns(uint256 assets);
   function maxLTV() external view returns(uint256);
   function userCollateralBalance(address _user) external view returns(uint256);
   function userBorrowShares(address _user) external view returns(uint256);
   function borrowAsset(
        uint256 _borrowAmount,
        uint256 _collateralAmount,
        address _receiver
    ) external returns (uint256 _shares);
   function addCollateral(uint256 _collateralAmount, address _borrower) external;
   function removeCollateral(
        uint256 _collateralAmount,
        address _receiver
    ) external;
   function repayAsset(uint256 _shares, address _borrower) external returns (uint256 _amountToRepay);
   function currentRateInfo() external view returns(CurrentRateInfo memory info);
   function exchangeRateInfo() external view returns(ExchangeRateInfo memory info);
   function updateExchangeRate()
        external
        returns (bool _isBorrowAllowed, uint256 _lowExchangeRate, uint256 _highExchangeRate);
   function addInterest(
        bool _returnAccounting
    )
        external
        returns (
            uint256 _interestEarned,
            uint256 _feesAmount,
            uint256 _feesShare,
            CurrentRateInfo memory _currentRateInfo,
            VaultAccount memory _totalAsset,
            VaultAccount memory _totalBorrow
        );
   function previewAddInterest()
        external
        view
        returns (
            uint256 _interestEarned,
            uint256 _feesAmount,
            uint256 _feesShare,
            CurrentRateInfo memory _newCurrentRateInfo,
            VaultAccount memory _totalAsset,
            VaultAccount memory _totalBorrow
        );
   function rateContract() external view returns(address);
}