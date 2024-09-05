// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Centralized.sol";
import "./PlatformFeeManager.sol";

interface DeceptionDerbyEvents {
    event LobbyCreated(uint indexed lobbyId, bool isPublic);
    event LobbyJoined(uint indexed lobbyId, address participant);
    event GameStarted(uint indexed lobbyId);
    event GameEnded(uint indexed lobbyId);
    event Withdrawal(address indexed user, uint amount);
}

contract DeceptionDerby is DeceptionDerbyEvents, Centralized, PlatformFeeManager {
    function setPlatformFee(uint feePercent) 
    public override 
    onlyOwner {
        super.setPlatformFee(feePercent);
    }

    constructor(uint _fee) 
    Centralized(msg.sender) 
    PlatformFeeManager(_fee) {}

    uint public lobbyIds;

    mapping(uint => address) public creatorOf;
    mapping(uint => uint) public anteOf;
    //
    mapping(uint => uint) public roomLimitFor;
    mapping(uint => address[]) public whitelistFor;
    //
    mapping(uint => address[]) public participantsOf;
    //
    mapping(uint => bool) public locked;
    // 
    mapping(uint => bool) public ended;

    function createPublicLobby(uint ante, uint roomLimit)
    external {
        lobbyIds++;
        creatorOf[lobbyIds] = msg.sender;
        anteOf[lobbyIds] = ante;
        roomLimitFor[lobbyIds] = roomLimit;
        emit LobbyCreated(lobbyIds, true);
    }

    function createPrivateLobby(uint ante, address[] memory whitelist)
    external {
        lobbyIds++;
        creatorOf[lobbyIds] = msg.sender;
        anteOf[lobbyIds] = ante;
        whitelistFor[lobbyIds] = whitelist;
        emit LobbyCreated(lobbyIds, false);
    }

    function isParticipant(uint lobbyId, address user) 
    internal view returns (bool) {
        address[] memory participants = participantsOf[lobbyId];
        for(uint idx = 0; idx < participants.length; idx++)
            if (participants[idx] == user) return true;
        return false;
    }

    function authorizedToJoin(uint lobbyId, address user) 
    internal view returns(bool authorized) {
        // bool authorized = false;
        address[] memory participants = participantsOf[lobbyId];
        uint limit = roomLimitFor[lobbyId];
        if (limit > 0) {  // isPublicLobby
            if (participants.length < limit) authorized = true;
        } else { // isPrivateLobby
            address[] memory whitelist = whitelistFor[lobbyId];
            for(uint idx = 0; idx < whitelist.length; idx++) 
                if (whitelist[idx] == user) authorized = true;
        }
        // return authorized;
    }

    function joinGame(uint lobbyId) 
    external payable {
        require(!locked[lobbyId], "in progress");
        require(!isParticipant(lobbyId, msg.sender), "already joined"); 
        require(authorizedToJoin(lobbyId, msg.sender), "!authorized");
        require(anteOf[lobbyId] == msg.value, "bad msg.value");
        participantsOf[lobbyId].push(msg.sender);
        emit LobbyJoined(lobbyId, msg.sender);
    }

    function startGame(uint lobbyId) 
    external {
        require(participantsOf[lobbyId].length > 2, "<3 players");
        require(!locked[lobbyId], "in progress");
        locked[lobbyId] = true;
        emit GameStarted(lobbyId);
    }

    mapping(address => uint) public deposits; 
    
    function endGame(uint lobbyId, uint[] memory weiAmounts, bytes memory signature)
    external {
        bytes32 hash = keccak256(abi.encodePacked(lobbyId, weiAmounts));
        require(isValidSignature(hash, signature), "!authorized");
        require(locked[lobbyId], "!started");
        require(!ended[lobbyId], "already ended");
        address[] memory participants = participantsOf[lobbyId];
        for(uint idx = 0; idx < participants.length; idx++)
            deposits[participants[idx]] += weiAmounts[idx];
        ended[lobbyId] = true;
        emit GameEnded(lobbyId);
    }

    function withdraw() 
    external {
        uint amount = deposits[msg.sender];
        deposits[msg.sender] = 0;
        bool sent = payable(msg.sender).send(amount);
        require(sent, "Withdrawal Failed");
        emit Withdrawal(msg.sender, amount);
    }
}