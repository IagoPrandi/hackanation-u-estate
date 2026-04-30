// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract PropertyValueToken {
    uint256 public immutable propertyId;
    address public immutable registry;
    address public authorizedOperator;

    constructor(
        uint256 propertyId_,
        address registry_,
        address authorizedOperator_
    ) {
        propertyId = propertyId_;
        registry = registry_;
        authorizedOperator = authorizedOperator_;
    }
}
