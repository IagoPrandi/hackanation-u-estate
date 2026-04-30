// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract PropertyValueTokenFactory {
    address public registry;
    address public primaryValueSale;

    constructor(address registry_, address primaryValueSale_) {
        registry = registry_;
        primaryValueSale = primaryValueSale_;
    }
}
