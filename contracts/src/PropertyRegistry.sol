// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ProtocolTypes} from "./libraries/ProtocolTypes.sol";

contract PropertyRegistry {
    uint256 public nextPropertyId = 1;
    address public owner;
    address public usufructRightNft;
    address public propertyValueTokenFactory;
    address public primaryValueSale;

    mapping(uint256 => bool) public propertyExists;
    mapping(uint256 => ProtocolTypes.PropertyRecord) public properties;
    mapping(uint256 => ProtocolTypes.UsufructPosition) public usufructPositions;
    mapping(address => uint256[]) private propertiesByOwner;
    mapping(uint256 => address[]) private participants;
    mapping(uint256 => mapping(address => bool)) public isParticipantForProperty;

    error Unauthorized();
    error ZeroAddress();
    error InvalidMarketValueWei();
    error InvalidLinkedValueBps();
    error InvalidMetadataHash();
    error InvalidDocumentsHash();
    error InvalidLocationHash();

    event ExternalContractsConfigured(
        address usufructRightNft,
        address propertyValueTokenFactory,
        address primaryValueSale
    );
    event PropertyRegistered(
        uint256 indexed propertyId,
        address indexed owner,
        uint256 marketValueWei,
        uint16 linkedValueBps,
        uint256 linkedValueUnits,
        uint256 freeValueUnits,
        bytes32 metadataHash,
        bytes32 documentsHash,
        bytes32 locationHash,
        ProtocolTypes.PropertyStatus status
    );
    event ParticipantAdded(uint256 indexed propertyId, address indexed participant);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }

        _;
    }

    function configureExternalContracts(
        address usufructRightNft_,
        address propertyValueTokenFactory_,
        address primaryValueSale_
    ) external onlyOwner {
        if (
            usufructRightNft_ == address(0) ||
            propertyValueTokenFactory_ == address(0) ||
            primaryValueSale_ == address(0)
        ) {
            revert ZeroAddress();
        }

        usufructRightNft = usufructRightNft_;
        propertyValueTokenFactory = propertyValueTokenFactory_;
        primaryValueSale = primaryValueSale_;

        emit ExternalContractsConfigured(
            usufructRightNft_,
            propertyValueTokenFactory_,
            primaryValueSale_
        );
    }

    function registerProperty(
        uint256 marketValueWei,
        uint16 linkedValueBps,
        bytes32 metadataHash,
        bytes32 documentsHash,
        bytes32 locationHash
    ) external returns (uint256 propertyId) {
        if (marketValueWei == 0) {
            revert InvalidMarketValueWei();
        }

        if (
            linkedValueBps == 0 || linkedValueBps >= ProtocolTypes.BPS_DENOMINATOR
        ) {
            revert InvalidLinkedValueBps();
        }

        if (metadataHash == bytes32(0)) {
            revert InvalidMetadataHash();
        }

        if (documentsHash == bytes32(0)) {
            revert InvalidDocumentsHash();
        }

        if (locationHash == bytes32(0)) {
            revert InvalidLocationHash();
        }

        propertyId = nextPropertyId;
        unchecked {
            nextPropertyId = propertyId + 1;
        }

        uint256 linkedValueUnits = (
            ProtocolTypes.TOTAL_VALUE_UNITS * linkedValueBps
        ) / ProtocolTypes.BPS_DENOMINATOR;
        uint256 freeValueUnits = ProtocolTypes.TOTAL_VALUE_UNITS - linkedValueUnits;

        properties[propertyId] = ProtocolTypes.PropertyRecord({
            propertyId: propertyId,
            owner: msg.sender,
            marketValueWei: marketValueWei,
            linkedValueBps: linkedValueBps,
            linkedValueUnits: linkedValueUnits,
            freeValueUnits: freeValueUnits,
            metadataHash: metadataHash,
            locationHash: locationHash,
            documentsHash: documentsHash,
            status: ProtocolTypes.PropertyStatus.PendingMockVerification
        });

        propertyExists[propertyId] = true;
        propertiesByOwner[msg.sender].push(propertyId);
        _addParticipant(propertyId, msg.sender);

        emit PropertyRegistered(
            propertyId,
            msg.sender,
            marketValueWei,
            linkedValueBps,
            linkedValueUnits,
            freeValueUnits,
            metadataHash,
            documentsHash,
            locationHash,
            ProtocolTypes.PropertyStatus.PendingMockVerification
        );
    }

    function getPropertiesByOwner(
        address ownerAddress
    ) external view returns (uint256[] memory) {
        return propertiesByOwner[ownerAddress];
    }

    function getParticipants(
        uint256 propertyId
    ) external view returns (address[] memory) {
        return participants[propertyId];
    }

    function totalValueUnits() external pure returns (uint256) {
        return ProtocolTypes.TOTAL_VALUE_UNITS;
    }

    function bpsDenominator() external pure returns (uint16) {
        return ProtocolTypes.BPS_DENOMINATOR;
    }

    function _addParticipant(uint256 propertyId, address participant) internal {
        if (isParticipantForProperty[propertyId][participant]) {
            return;
        }

        isParticipantForProperty[propertyId][participant] = true;
        participants[propertyId].push(participant);

        emit ParticipantAdded(propertyId, participant);
    }
}
