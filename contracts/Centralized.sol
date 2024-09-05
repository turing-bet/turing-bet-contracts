// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Centralized is Ownable {
    using ECDSA for bytes32;

    constructor(address fiduciary) Ownable(fiduciary) {}

    // For Verifying Backend Signatures
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) internal view returns (bool) {
        bytes32 signedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        return signedHash.recover(signature) == owner();
    }
}