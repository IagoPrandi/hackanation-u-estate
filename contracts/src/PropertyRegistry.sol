// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ProtocolTypes} from "./libraries/ProtocolTypes.sol";

contract PropertyRegistry {
    using ProtocolTypes for ProtocolTypes.PropertyRecord;

    uint256 public nextPropertyId = 1;
    address public usufructRightNft;
    address public propertyValueTokenFactory;
    address public primaryValueSale;

    mapping(uint256 => bool) public propertyExists;

    event ExternalContractsConfigured(
        address usufructRightNft,
        address propertyValueTokenFactory,
        address primaryValueSale
    );

    function configureExternalContracts(
        address usufructRightNft_,
        address propertyValueTokenFactory_,
        address primaryValueSale_
    ) external {
        usufructRightNft = usufructRightNft_;
        propertyValueTokenFactory = propertyValueTokenFactory_;
        primaryValueSale = primaryValueSale_;

        emit ExternalContractsConfigured(
            usufructRightNft_,
            propertyValueTokenFactory_,
            primaryValueSale_
        );
    }
}
