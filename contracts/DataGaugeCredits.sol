// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DataGaugeCredits
 * @notice Users deposit GoodDollar (G$) tokens as on-chain credits.
 *         When purchasing data, the user calls spend() which deducts
 *         from their balance and forwards G$ to the agent wallet.
 *         The DataGauge frontend then calls VTPass to deliver data.
 *
 * Deployed on Celo mainnet.
 * G$ token: 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

contract DataGaugeCredits {
    IERC20 public immutable GD_TOKEN;
    address public immutable agentWallet;

    /// @dev G$ credit balance per user address (18 decimals)
    mapping(address => uint256) public credits;

    // ── Events ──────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount);
    event Spent(address indexed user, uint256 amount, string planId, bytes32 phoneHash);
    event Withdrawn(address indexed user, uint256 amount);

    // ── Errors ───────────────────────────────────────────────
    error InsufficientCredits(uint256 have, uint256 need);
    error TransferFailed();
    error ZeroAmount();
    error ContractNotConfigured();

    constructor(address _gdToken, address _agentWallet) {
        require(_gdToken != address(0), "Invalid G$ token");
        require(_agentWallet != address(0), "Invalid agent wallet");
        GD_TOKEN = IERC20(_gdToken);
        agentWallet = _agentWallet;
    }

    // ── Deposit ──────────────────────────────────────────────

    /**
     * @notice Deposit G$ into your DataGauge credit balance.
     *         You must first approve this contract on the G$ token:
     *         G$.approve(DataGaugeCredits_address, amount)
     * @param amount G$ amount in wei (18 decimals)
     */
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!GD_TOKEN.transferFrom(msg.sender, address(this), amount))
            revert TransferFailed();
        credits[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    // ── Spend ────────────────────────────────────────────────

    /**
     * @notice Spend G$ credits to purchase mobile data.
     *         Called by the USER when initiating a data purchase.
     *         Deducts from balance and sends G$ to the agent wallet.
     *         The app then calls VTPass to complete the data delivery.
     *
     * @param amount    G$ amount in wei
     * @param planId    VTPass variation_code (e.g. "mtn-smb1000")
     * @param phoneHash keccak256 of the recipient phone number (privacy)
     */
    function spend(
        uint256 amount,
        string calldata planId,
        bytes32 phoneHash
    ) external {
        if (amount == 0) revert ZeroAmount();
        if (credits[msg.sender] < amount)
            revert InsufficientCredits(credits[msg.sender], amount);

        credits[msg.sender] -= amount;
        if (!GD_TOKEN.transfer(agentWallet, amount)) revert TransferFailed();

        emit Spent(msg.sender, amount, planId, phoneHash);
    }

    // ── Withdraw ─────────────────────────────────────────────

    /**
     * @notice Withdraw unspent G$ credits back to your wallet.
     * @param amount G$ amount in wei to withdraw
     */
    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (credits[msg.sender] < amount)
            revert InsufficientCredits(credits[msg.sender], amount);

        credits[msg.sender] -= amount;
        if (!GD_TOKEN.transfer(msg.sender, amount)) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    // ── Views ────────────────────────────────────────────────

    /// @notice Read credit balance for any address
    function balanceOf(address user) external view returns (uint256) {
        return credits[user];
    }

    /// @notice Check whether a user can afford a given amount
    function hasCredits(address user, uint256 amount) external view returns (bool) {
        return credits[user] >= amount;
    }
}
