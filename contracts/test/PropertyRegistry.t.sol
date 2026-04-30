// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PropertyRegistry} from "../src/PropertyRegistry.sol";
import {ProtocolTypes} from "../src/libraries/ProtocolTypes.sol";

interface Vm {
    function expectRevert(bytes calldata revertData) external;
    function prank(address caller) external;
}

contract PropertyRegistryTest {
    Vm internal constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    PropertyRegistry internal registry;

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    bytes32 internal constant METADATA_HASH = bytes32(uint256(1));
    bytes32 internal constant DOCUMENTS_HASH = bytes32(uint256(2));
    bytes32 internal constant LOCATION_HASH = bytes32(uint256(3));

    function setUp() public {
        registry = new PropertyRegistry();
    }

    function testRegisterPropertyStoresRecordAndIndexesOwner() external {
        vm.prank(ALICE);
        uint256 propertyId = registry.registerProperty(
            10 ether,
            2_000,
            METADATA_HASH,
            DOCUMENTS_HASH,
            LOCATION_HASH
        );

        require(propertyId == 1, "property id mismatch");
        require(registry.propertyExists(propertyId), "propertyExists false");
        require(registry.nextPropertyId() == 2, "nextPropertyId mismatch");

        (
            uint256 storedPropertyId,
            address storedOwner,
            uint256 marketValueWei,
            uint16 linkedValueBps,
            uint256 linkedValueUnits,
            uint256 freeValueUnits,
            bytes32 metadataHash,
            bytes32 locationHash,
            bytes32 documentsHash,
            ProtocolTypes.PropertyStatus status
        ) = registry.properties(propertyId);

        require(storedPropertyId == propertyId, "stored property id mismatch");
        require(storedOwner == ALICE, "stored owner mismatch");
        require(marketValueWei == 10 ether, "market value mismatch");
        require(linkedValueBps == 2_000, "linked bps mismatch");
        require(linkedValueUnits == 200_000, "linked units mismatch");
        require(freeValueUnits == 800_000, "free units mismatch");
        require(metadataHash == METADATA_HASH, "metadata hash mismatch");
        require(locationHash == LOCATION_HASH, "location hash mismatch");
        require(documentsHash == DOCUMENTS_HASH, "documents hash mismatch");
        require(
            uint8(status) ==
                uint8(ProtocolTypes.PropertyStatus.PendingMockVerification),
            "status mismatch"
        );

        uint256[] memory ownerProperties = registry.getPropertiesByOwner(ALICE);
        require(ownerProperties.length == 1, "owner property count mismatch");
        require(ownerProperties[0] == propertyId, "owner property id mismatch");

        address[] memory propertyParticipants = registry.getParticipants(
            propertyId
        );
        require(
            propertyParticipants.length == 1,
            "participant count mismatch"
        );
        require(propertyParticipants[0] == ALICE, "participant mismatch");
        require(
            registry.isParticipantForProperty(propertyId, ALICE),
            "participant flag mismatch"
        );
    }

    function testRegisterPropertyTracksPropertiesPerOwner() external {
        vm.prank(ALICE);
        registry.registerProperty(
            10 ether,
            2_000,
            METADATA_HASH,
            DOCUMENTS_HASH,
            LOCATION_HASH
        );

        vm.prank(ALICE);
        registry.registerProperty(
            5 ether,
            1_500,
            bytes32(uint256(4)),
            bytes32(uint256(5)),
            bytes32(uint256(6))
        );

        vm.prank(BOB);
        registry.registerProperty(
            8 ether,
            2_500,
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            bytes32(uint256(9))
        );

        uint256[] memory aliceProperties = registry.getPropertiesByOwner(ALICE);
        uint256[] memory bobProperties = registry.getPropertiesByOwner(BOB);

        require(aliceProperties.length == 2, "alice property count mismatch");
        require(aliceProperties[0] == 1, "alice property #1 mismatch");
        require(aliceProperties[1] == 2, "alice property #2 mismatch");
        require(bobProperties.length == 1, "bob property count mismatch");
        require(bobProperties[0] == 3, "bob property mismatch");
    }

    function testRegisterPropertyRejectsInvalidMarketValue() external {
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.InvalidMarketValueWei.selector)
        );

        registry.registerProperty(
            0,
            2_000,
            METADATA_HASH,
            DOCUMENTS_HASH,
            LOCATION_HASH
        );
    }

    function testRegisterPropertyRejectsInvalidLinkedValueBps() external {
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.InvalidLinkedValueBps.selector)
        );
        registry.registerProperty(
            10 ether,
            0,
            METADATA_HASH,
            DOCUMENTS_HASH,
            LOCATION_HASH
        );

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.InvalidLinkedValueBps.selector)
        );
        registry.registerProperty(
            10 ether,
            10_000,
            METADATA_HASH,
            DOCUMENTS_HASH,
            LOCATION_HASH
        );
    }

    function testRegisterPropertyRejectsZeroHashes() external {
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.InvalidMetadataHash.selector)
        );
        registry.registerProperty(
            10 ether,
            2_000,
            bytes32(0),
            DOCUMENTS_HASH,
            LOCATION_HASH
        );

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.InvalidDocumentsHash.selector)
        );
        registry.registerProperty(
            10 ether,
            2_000,
            METADATA_HASH,
            bytes32(0),
            LOCATION_HASH
        );

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.InvalidLocationHash.selector)
        );
        registry.registerProperty(
            10 ether,
            2_000,
            METADATA_HASH,
            DOCUMENTS_HASH,
            bytes32(0)
        );
    }

    function testConfigureExternalContractsOnlyOwner() external {
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(PropertyRegistry.Unauthorized.selector)
        );
        registry.configureExternalContracts(ALICE, BOB, address(0xCAFE));
    }

    function testConfigureExternalContractsRejectsZeroAddress() external {
        vm.expectRevert(abi.encodeWithSelector(PropertyRegistry.ZeroAddress.selector));
        registry.configureExternalContracts(address(0), BOB, address(0xCAFE));
    }
}
