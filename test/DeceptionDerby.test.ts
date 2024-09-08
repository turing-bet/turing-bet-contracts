import { expect } from "chai";
import { ethers } from "hardhat";
import { DeceptionDerby } from "../typechain-types";

describe("DeceptionDerby", function () {
  let deceptionDerby: DeceptionDerby;
  let owner: any, addr1: any, addr2: any, addr3: any;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const DeceptionDerbyFactory = await ethers.getContractFactory("DeceptionDerby");
    deceptionDerby = (await DeceptionDerbyFactory.deploy(5)) as DeceptionDerby; // Initialize with a 5% platform fee
  });

  it("should create and manage a public lobby", async function () {
    const lobbyId = 1;

    // Create a public lobby
    await deceptionDerby.connect(addr1).createPublicLobby(ethers.parseEther("1"), 2);
    
    // Verify the lobby creator and public state
    expect(await deceptionDerby.creatorOf(lobbyId)).to.equal(addr1.address);
    expect(await deceptionDerby.roomLimitFor(lobbyId)).to.equal(2);

    // addr2 joins the game
    await deceptionDerby.connect(addr2).joinGame(lobbyId, { value: ethers.parseEther("1") });

    // Check participants
    expect(await deceptionDerby.participantsOf(lobbyId, BigInt(0))).to.equal(addr1.address);
    expect(await deceptionDerby.participantsOf(lobbyId, BigInt(1))).to.equal(addr2.address);

    // Start the game
    await deceptionDerby.connect(addr1).startGame(lobbyId);
    expect(await deceptionDerby.locked(lobbyId)).to.be.true;

    const weiAmounts = [ethers.parseEther("1"), ethers.parseEther("1")];

    // End the game with a valid signature
    const encodedData = ethers.solidityPacked(["uint256", "uint256[]"], [lobbyId, weiAmounts]);
    const hash = ethers.keccak256(encodedData);
    const signature = await owner.signMessage(ethers.getBytes(hash));
    await deceptionDerby.connect(owner).endGame(lobbyId, weiAmounts, signature);

    // Check that the game has ended and deposits were updated
    expect(await deceptionDerby.ended(lobbyId)).to.be.true;
    expect(await deceptionDerby.deposits(addr1.address)).to.equal(ethers.parseEther("1"));
    expect(await deceptionDerby.deposits(addr2.address)).to.equal(ethers.parseEther("1"));
  });

  it("should create and manage a private lobby", async function () {
    const lobbyId = 1;

    // Create a private lobby with a whitelist (addr1 and addr2)
    const whitelist = [addr1.address, addr2.address];
    await deceptionDerby.connect(addr1).createPrivateLobby(ethers.parseEther("1"), whitelist);

    // Check lobby creator and whitelist
    expect(await deceptionDerby.creatorOf(lobbyId)).to.equal(addr1.address);
    expect(await deceptionDerby.whitelistFor(BigInt(lobbyId), BigInt(0) )).to.include(addr1.address);
    expect(await deceptionDerby.whitelistFor(BigInt(lobbyId), BigInt(1))).to.include(addr2.address);

    // addr2, whitelisted, joins the game
    await deceptionDerby.connect(addr2).joinGame(lobbyId, { value: ethers.parseEther("1") });

    // addr3 is not whitelisted, so should be unable to join
    await expect(
      deceptionDerby.connect(addr3).joinGame(lobbyId, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("!authorized");

    // Start the game
    await deceptionDerby.connect(addr1).startGame(lobbyId);
    expect(await deceptionDerby.locked(lobbyId)).to.be.true;

    const weiAmounts = [ethers.parseEther("1"), ethers.parseEther("1")];

    // End the game with a valid signature
    const encodedData = ethers.solidityPacked(["uint256", "uint256[]"], [lobbyId, weiAmounts]);
    const hash = ethers.keccak256(encodedData);
    const signature = await owner.signMessage(ethers.getBytes(hash));
    await deceptionDerby.connect(owner).endGame(lobbyId, weiAmounts, signature);

    // Check that the game has ended and deposits were updated
    expect(await deceptionDerby.ended(lobbyId)).to.be.true;
    expect(await deceptionDerby.deposits(addr1.address)).to.equal(ethers.parseEther("1"));
    expect(await deceptionDerby.deposits(addr2.address)).to.equal(ethers.parseEther("1"));
  });

  it("should revert if the game is already ended", async function () {
    const lobbyId = 1;

    // Create and start a public lobby
    await deceptionDerby.connect(addr1).createPublicLobby(ethers.parseEther("1"), 2);
    await deceptionDerby.connect(addr2).joinGame(lobbyId, { value: ethers.parseEther("1") });
    await deceptionDerby.connect(addr1).startGame(lobbyId);

    const weiAmounts = [ethers.parseEther("1"), ethers.parseEther("1")];
    const encodedData = ethers.solidityPacked(["uint256", "uint256[]"], [lobbyId, weiAmounts]);
    const hash = ethers.keccak256(encodedData);
    const signature = await owner.signMessage(ethers.getBytes(hash));

    // End the game
    await deceptionDerby.connect(owner).endGame(lobbyId, weiAmounts, signature);

    // Attempt to end the game again, should revert
    await expect(deceptionDerby.connect(owner).endGame(lobbyId, weiAmounts, signature)).to.be.revertedWith(
      "already ended"
    );
  });

  it("should allow participants to withdraw their funds after the game", async function () {
    const lobbyId = 1;

    // Create and start a public lobby
    await deceptionDerby.connect(addr1).createPublicLobby(ethers.parseEther("1"), 2);
    await deceptionDerby.connect(addr2).joinGame(lobbyId, { value: ethers.parseEther("1") });
    await deceptionDerby.connect(addr1).startGame(lobbyId);

    const weiAmounts = [ethers.parseEther("1"), ethers.parseEther("1")];
    const encodedData = ethers.solidityPacked(["uint256", "uint256[]"], [lobbyId, weiAmounts]);
    const hash = ethers.keccak256(encodedData);
    const signature = await owner.signMessage(ethers.getBytes(hash));

    // End the game
    await deceptionDerby.connect(owner).endGame(lobbyId, weiAmounts, signature);

    // Withdraw funds for addr1
    const initialBalanceAddr1 = await ethers.provider.getBalance(addr1.address);
    const tx = await deceptionDerby.connect(addr1).withdraw();
    const receipt = await tx.wait();

    const gasUsed = receipt?.gasUsed ? receipt.gasUsed : BigInt(0);
    const gasPrice = tx.gasPrice ? tx.gasPrice : BigInt(0);
    const totalGasCost = gasUsed * gasPrice;

    const finalBalanceAddr1 = await ethers.provider.getBalance(addr1.address);

    // Assert that the balance has increased by the correct amount
    expect(finalBalanceAddr1).to.equal(
      initialBalanceAddr1 + ethers.parseEther("1") - totalGasCost
    );
  });
});
