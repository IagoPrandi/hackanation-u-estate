// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PropertyRegistry} from "./PropertyRegistry.sol";
import {PropertyValueToken} from "./PropertyValueToken.sol";
import {ProtocolTypes} from "./libraries/ProtocolTypes.sol";

contract PrimaryValueSale {
    address public immutable registry;

    uint256 public nextListingId = 1;

    mapping(uint256 => bool) public listingExists;
    mapping(uint256 => ProtocolTypes.PrimarySaleListing) public listings;

    uint256[] private listingIds;
    mapping(uint256 => uint256[]) private listingsByProperty;
    mapping(uint256 => uint256) public activeListingsCountByProperty;
    mapping(uint256 => uint256) public totalFreeValueSoldByProperty;
    mapping(uint256 => uint256) public activeEscrowedAmountByProperty;

    error Unauthorized();
    error ZeroAddress();
    error PropertyNotFound();
    error InvalidPropertyStatus();
    error InvalidAmount();
    error InsufficientBalance();
    error PriceZero();

    event PrimarySaleListed(
        uint256 indexed listingId,
        uint256 indexed propertyId,
        address indexed seller,
        uint256 amount,
        uint256 priceWei
    );
    event TokensEscrowed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 amount
    );

    constructor(address registry_) {
        if (registry_ == address(0)) {
            revert ZeroAddress();
        }

        registry = registry_;
    }

    function createPrimarySaleListing(
        uint256 propertyId,
        uint256 amount
    ) external returns (uint256 listingId) {
        PropertyRegistry registryContract = PropertyRegistry(registry);

        if (!registryContract.propertyExists(propertyId)) {
            revert PropertyNotFound();
        }

        (
            ,
            address owner,
            uint256 marketValueWei,
            ,
            ,
            ,
            ,
            ,
            ,
            address valueTokenAddress,
            ProtocolTypes.PropertyStatus propertyStatus
        ) = registryContract.properties(propertyId);

        if (
            propertyStatus != ProtocolTypes.PropertyStatus.Tokenized &&
            propertyStatus != ProtocolTypes.PropertyStatus.ActiveSale
        ) {
            revert InvalidPropertyStatus();
        }

        if (msg.sender != owner) {
            revert Unauthorized();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        PropertyValueToken valueToken = PropertyValueToken(valueTokenAddress);
        if (amount > valueToken.balanceOf(msg.sender)) {
            revert InsufficientBalance();
        }

        uint256 priceWei = (marketValueWei * amount) /
            ProtocolTypes.TOTAL_VALUE_UNITS;
        if (priceWei == 0) {
            revert PriceZero();
        }

        listingId = nextListingId;
        unchecked {
            nextListingId = listingId + 1;
        }

        listingExists[listingId] = true;
        valueToken.operatorTransfer(msg.sender, address(this), amount);

        activeEscrowedAmountByProperty[propertyId] += amount;
        activeListingsCountByProperty[propertyId] += 1;

        listings[listingId] = ProtocolTypes.PrimarySaleListing({
            listingId: listingId,
            propertyId: propertyId,
            seller: msg.sender,
            amount: amount,
            priceWei: priceWei,
            status: ProtocolTypes.SaleStatus.Active
        });

        listingIds.push(listingId);
        listingsByProperty[propertyId].push(listingId);

        registryContract.syncPropertySaleStatus(
            propertyId,
            ProtocolTypes.PropertyStatus.ActiveSale
        );

        emit PrimarySaleListed(
            listingId,
            propertyId,
            msg.sender,
            amount,
            priceWei
        );
        emit TokensEscrowed(listingId, msg.sender, amount);
    }

    function getListingIds() external view returns (uint256[] memory) {
        return listingIds;
    }

    function getListingsByProperty(
        uint256 propertyId
    ) external view returns (uint256[] memory) {
        return listingsByProperty[propertyId];
    }
}
