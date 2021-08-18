const { expect } = require("chai");
const fs = require('fs')
const { ethers, network, deployments } = require("hardhat");
const { accountFixture } = require("./fixtures")



describe("DexStrategyV4", function() {

    it("deposit and withdraw", async () => {
        let {alice} = await accountFixture()
        const farm = await ethers.getContractAt("DexStrategyV4", "0xA544b965C2a05b97C44f3126cec916332aFb3175", alice.account)

        await alice.token.approve(farm.address, alice.balance)

        await farm.deposit(alice.balance)
        let farmBalance = await farm.balanceOf(alice.address)
        expect(farmBalance.gt(0)).to.be.true
        
        await farm.withdraw(farmBalance)
        farmBalance = await farm.balanceOf(alice.address)
        expect(farmBalance.gt(0)).to.be.false
        
        let newBalance = await alice.token.balanceOf(alice.address)
        expect(newBalance.lte(alice.balance)).to.be.true
        expect(newBalance.gt(0)).to.be.true
    }).timeout(50000)
})

