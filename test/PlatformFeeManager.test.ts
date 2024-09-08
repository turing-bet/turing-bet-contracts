import { expect } from "chai";
import { ethers } from "hardhat";
import { PlatformFeeManager } from "../typechain-types";

describe("PlatformFeeManager", function () {
  let platformFeeManager: PlatformFeeManager;

  beforeEach(async function () {
    const PlatformFeeManagerFactory = await ethers.getContractFactory("PlatformFeeManager");
    platformFeeManager = (await PlatformFeeManagerFactory.deploy(5)) as PlatformFeeManager; // 5% fee
  });

  it("should set the initial platform fee", async function () {
    const fee = await platformFeeManager.platformFee();
    expect(fee).to.equal(5);
  });

  it("should allow updating the platform fee", async function () {
    await platformFeeManager.setPlatformFee(10);
    const updatedFee = await platformFeeManager.platformFee();
    expect(updatedFee).to.equal(10);
  });
});
