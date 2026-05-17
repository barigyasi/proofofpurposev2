// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPurposeTokenV2 {
    function mint(address to, uint256 amount) external;
}

/**
 * @title BountyManagerV2
 * @notice Tracks bounties off-chain-coordinated by the Proof of Purpose admin
 *         and mints PURPOSE rewards to verified participants.
 *
 * Same surface as BountyManagerV1 — only the token address changes (V2). The
 * admin EOA holds BOUNTY_ADMIN_ROLE and the contract itself must be granted
 * MINTER_ROLE on PurposeTokenV2.
 */
contract BountyManagerV2 is AccessControl, ReentrancyGuard {
    bytes32 public constant BOUNTY_ADMIN_ROLE = keccak256("BOUNTY_ADMIN_ROLE");

    IPurposeTokenV2 public immutable purposeToken;

    struct Bounty {
        uint256 rewardAmount;
        uint32 minParticipants;
        bool started;
        bool completed;
        address[] participants;
        mapping(address => bool) signedUp;
        mapping(address => bool) checkedIn;
    }

    uint256 public nextBountyId;
    mapping(uint256 => Bounty) private _bounties;

    event BountyCreated(uint256 indexed id, uint256 rewardAmount, uint32 minParticipants);
    event ParticipantAdded(uint256 indexed id, address indexed participant);
    event ParticipantCheckedIn(uint256 indexed id, address indexed participant);
    event BountyStarted(uint256 indexed id);
    event BountyEnded(uint256 indexed id, uint256 totalMinted);

    error AlreadySignedUp();
    error NotSignedUp();
    error AlreadyCheckedIn();
    error NotEnoughCheckedIn();
    error AlreadyCompleted();
    error NotStarted();

    constructor(address admin, address token) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BOUNTY_ADMIN_ROLE, admin);
        purposeToken = IPurposeTokenV2(token);
    }

    function createBounty(uint256 _rewardAmount, uint32 minParticipants)
        external
        onlyRole(BOUNTY_ADMIN_ROLE)
        returns (uint256 id)
    {
        id = nextBountyId++;
        Bounty storage b = _bounties[id];
        b.rewardAmount = _rewardAmount;
        b.minParticipants = minParticipants;
        emit BountyCreated(id, _rewardAmount, minParticipants);
    }

    function addParticipant(uint256 id, address participant)
        external
        onlyRole(BOUNTY_ADMIN_ROLE)
    {
        Bounty storage b = _bounties[id];
        if (b.completed) revert AlreadyCompleted();
        if (b.signedUp[participant]) revert AlreadySignedUp();
        b.signedUp[participant] = true;
        b.participants.push(participant);
        emit ParticipantAdded(id, participant);
    }

    function checkIn(uint256 id, address participant)
        external
        onlyRole(BOUNTY_ADMIN_ROLE)
    {
        Bounty storage b = _bounties[id];
        if (b.completed) revert AlreadyCompleted();
        if (!b.signedUp[participant]) revert NotSignedUp();
        if (b.checkedIn[participant]) revert AlreadyCheckedIn();
        b.checkedIn[participant] = true;
        emit ParticipantCheckedIn(id, participant);
    }

    function startBounty(uint256 id) external onlyRole(BOUNTY_ADMIN_ROLE) {
        Bounty storage b = _bounties[id];
        if (b.completed) revert AlreadyCompleted();
        b.started = true;
        emit BountyStarted(id);
    }

    function endBounty(uint256 id)
        external
        nonReentrant
        onlyRole(BOUNTY_ADMIN_ROLE)
    {
        Bounty storage b = _bounties[id];
        if (b.completed) revert AlreadyCompleted();
        if (!b.started) revert NotStarted();

        uint256 minted;
        uint256 reward = b.rewardAmount;
        uint256 checkedInCount;
        for (uint256 i = 0; i < b.participants.length; i++) {
            address p = b.participants[i];
            if (b.checkedIn[p]) {
                checkedInCount++;
                purposeToken.mint(p, reward);
                minted += reward;
            }
        }
        if (checkedInCount < b.minParticipants) revert NotEnoughCheckedIn();

        b.completed = true;
        emit BountyEnded(id, minted);
    }

    // -- Views --
    function rewardAmount(uint256 id) external view returns (uint256) {
        return _bounties[id].rewardAmount;
    }

    function isCheckedIn(uint256 id, address participant)
        external
        view
        returns (bool)
    {
        return _bounties[id].checkedIn[participant];
    }

    function participants(uint256 id) external view returns (address[] memory) {
        return _bounties[id].participants;
    }
}
