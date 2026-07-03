// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {SepoliaZamaOracleAddress} from "@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol";

/**
 * @title NullClaim
 * @notice FHE-powered insurance claim fraud detection.
 *         Evaluates encrypted claims for fraud signals without ever
 *         decrypting the underlying data. Only a boolean verdict is revealed.
 *
 * @dev Built with Zama FHEVM (@fhevm/solidity) for the Zama Developer Program.
 *      Deployed on Ethereum Sepolia testnet.
 *
 * Fraud rules (all computed over ciphertext):
 *   1. FHE.gt(amount, maxThreshold)       — amount exceeds ceiling
 *   2. FHE.eq(providerId, blacklist[i])   — provider is blacklisted
 *   3. velocity check via submitter claim count
 */
contract NullClaim is SepoliaConfig {
    // ─── Structs ─────────────────────────────────────────────────────────────

    struct Claim {
        address submitter;
        euint64 encAmount; // Claim amount in USD ×100
        euint64 encProviderId; // Numeric provider ID
        euint64 encPatientHash; // Hashed patient identifier
        euint64 encServiceCode; // ICD / CPT service code
        euint64 encTimestamp; // Claim date as unix timestamp
        bool verdictDecrypted;
        bool isFraud;
        uint256 submittedAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    address public owner;

    uint256 public claimCount;
    mapping(uint256 => Claim) private claims;
    mapping(address => uint256[]) private submitterClaims;

    euint64 private encMaxAmount;
    euint64[] private encBlacklist;

    uint256 public constant DAILY_RATE_LIMIT = 10;

    // Maps decryption requestId → claimId for the Gateway callback
    mapping(uint256 => uint256) private requestToClaimId;

    // ─── Events ──────────────────────────────────────────────────────────────

    event ClaimSubmitted(uint256 indexed claimId, address indexed submitter);
    event VerdictReady(uint256 indexed claimId, bool isFraud);
    event ThresholdUpdated();
    event ProviderBlacklisted();

    // ─── Errors ──────────────────────────────────────────────────────────────

    error Unauthorized();
    error ClaimNotFound();

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _initialMaxAmount Initial fraud threshold in USD ×100
     *                          e.g. 5_000_000 = $50,000.00
     */
    constructor(uint64 _initialMaxAmount) {
        owner = msg.sender;
        encMaxAmount = FHE.asEuint64(_initialMaxAmount);
        FHE.allowThis(encMaxAmount);
    }

    // ─── Submit Claim ─────────────────────────────────────────────────────────

    /**
     * @notice Submit an FHE-encrypted insurance claim.
     *         All inputs are externalEuint64 ciphertexts — no plaintext accepted.
     */
    function submitClaim(
        externalEuint64 _encAmount,
        externalEuint64 _encProviderId,
        externalEuint64 _encPatientHash,
        externalEuint64 _encServiceCode,
        externalEuint64 _encTimestamp,
        bytes calldata inputProof
    ) external returns (uint256 claimId) {
        claimId = ++claimCount;

        euint64 amount = FHE.fromExternal(_encAmount, inputProof);
        euint64 providerId = FHE.fromExternal(_encProviderId, inputProof);
        euint64 patientHash = FHE.fromExternal(_encPatientHash, inputProof);
        euint64 serviceCode = FHE.fromExternal(_encServiceCode, inputProof);
        euint64 timestamp = FHE.fromExternal(_encTimestamp, inputProof);

        FHE.allowThis(amount);
        FHE.allowThis(providerId);
        FHE.allowThis(patientHash);
        FHE.allowThis(serviceCode);
        FHE.allowThis(timestamp);

        claims[claimId] = Claim({
            submitter: msg.sender,
            encAmount: amount,
            encProviderId: providerId,
            encPatientHash: patientHash,
            encServiceCode: serviceCode,
            encTimestamp: timestamp,
            verdictDecrypted: false,
            isFraud: false,
            submittedAt: block.timestamp
        });

        submitterClaims[msg.sender].push(claimId);

        emit ClaimSubmitted(claimId, msg.sender);

        _evaluateClaim(claimId);
    }

    // ─── FHE Evaluation ──────────────────────────────────────────────────────

    function _evaluateClaim(uint256 claimId) internal {
        Claim storage c = claims[claimId];

        // Rule 1: Amount exceeds maximum threshold
        ebool amountBreached = FHE.gt(c.encAmount, encMaxAmount);

        // Rule 2: Provider is blacklisted
        ebool providerBlacklisted = FHE.asEbool(false);
        for (uint256 i = 0; i < encBlacklist.length; i++) {
            ebool isMatch = FHE.eq(c.encProviderId, encBlacklist[i]);
            providerBlacklisted = FHE.or(providerBlacklisted, isMatch);
        }

        // Rule 3: Velocity — submitter exceeds daily rate limit
        ebool velocityFlag = FHE.asEbool(
            submitterClaims[c.submitter].length > DAILY_RATE_LIMIT
        );

        // Aggregate: any flag = fraud

        ebool isFraud = FHE.or(amountBreached, providerBlacklisted);
        isFraud = FHE.or(isFraud, velocityFlag);

        // Grant this contract persistent access to the result
        FHE.allowThis(isFraud);

        // Request public decryption of ONLY the boolean verdict
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(isFraud);

        uint256 requestId = FHE.requestDecryption(
            cts,
            this.onVerdictDecrypted.selector
        );

        requestToClaimId[requestId] = claimId;
    }

    // ─── Decryption Callback ─────────────────────────────────────────────────

    /**
     * @notice Called by the Zama decryption oracle after threshold decryption.
     *         Only the boolean verdict is ever decrypted — no claim details.
     * @param requestId   The original decryption request ID
     * @param cleartexts  ABI-encoded decrypted values (single bool)
     */
    function onVerdictDecrypted(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory /* decryptionProof */
    ) external {
        // Only the FHEVM decryption oracle may call this
        require(
            msg.sender == SepoliaZamaOracleAddress,
            "NullClaim: caller is not oracle"
        );

        bool verdict = abi.decode(cleartexts, (bool));

        uint256 claimId = requestToClaimId[requestId];
        Claim storage c = claims[claimId];
        c.verdictDecrypted = true;
        c.isFraud = verdict;

        emit VerdictReady(claimId, verdict);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function updateMaxAmount(
        externalEuint64 _encNewMax,
        bytes calldata inputProof
    ) external onlyOwner {
        euint64 newMax = FHE.fromExternal(_encNewMax, inputProof);
        FHE.allowThis(newMax);
        encMaxAmount = newMax;
        emit ThresholdUpdated();
    }

    function blacklistProvider(
        externalEuint64 _encProviderId,
        bytes calldata inputProof
    ) external onlyOwner {
        euint64 pid = FHE.fromExternal(_encProviderId, inputProof);
        FHE.allowThis(pid);
        encBlacklist.push(pid);
        emit ProviderBlacklisted();
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getVerdict(
        uint256 claimId
    )
        external
        view
        returns (
            bool decrypted,
            bool isFraud,
            address submitter,
            uint256 submittedAt
        )
    {
        Claim storage c = claims[claimId];
        if (c.submitter == address(0)) revert ClaimNotFound();
        return (c.verdictDecrypted, c.isFraud, c.submitter, c.submittedAt);
    }

    function getClaimsBySubmitter(
        address submitter
    ) external view returns (uint256[] memory) {
        return submitterClaims[submitter];
    }

    function totalClaims() external view returns (uint256) {
        return claimCount;
    }

    function blacklistSize() external view returns (uint256) {
        return encBlacklist.length;
    }
}
