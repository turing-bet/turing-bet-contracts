// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface PlatformFeeManagerEvents {
    event PlatformFeeUpdated(uint feePercent);
}

contract PlatformFeeManager is PlatformFeeManagerEvents {
    uint private _platformFee;

    function platformFee() public view returns (uint) {
        return _platformFee;
    }

    function _setPlatformFee(uint feePercent) private {
        _platformFee = feePercent;
        emit PlatformFeeUpdated(feePercent);
    }

    function setPlatformFee(uint feePercent) public virtual {
        _setPlatformFee(feePercent);
    }

    // Suggested Value
    // platformFeePercent = 5
    constructor(uint platformFeePercent) {
        _setPlatformFee(platformFeePercent);
    }
}
