const { expect } = require("chai");
const fs = require("fs");
const { ethers, network, deployments } = require("hardhat");
const { accounts, accountsFixture, tokens, pairs, stakingRewards } = require("./fixtures");
const { fundLiquidityToken, getTokenContract, getPairContract, oneWeek } = require("./utils");

const BigNumber = ethers.BigNumber
const ONE_EXP_17 = BigNumber.from("10000000000000000");

describe("DexStrategyV6", function () {

    let owner
    let deployer
    let alice
    let bob

    beforeEach(async () => {
        ({ owner, deployer, alice, bob } = await accountsFixture())
    })

    it("Can deploy", async () => {
        const dexStrategyV6 = await deployV6()
        expect(await dexStrategyV6.stakingContract()).to.be.equal(stakingRewards.PGL.AVAX.PNG)
        expect(await dexStrategyV6.owner()).to.be.equal(owner.address)
    })

    it("test deposit", async () => {
        const dexStrategyV6 = await deployV6()
        const farm = dexStrategyV6.connect(alice)
        const liquidityToken = await getTokenContract(pairs.AVAX.PNG, alice)
        const liquidityBalance = await fundLiquidityToken(alice, liquidityToken.address, ethers.utils.parseEther("10"))
        const totalDepositsBefore = await farm.totalDeposits()

        await liquidityToken.approve(farm.address, liquidityBalance)
        await farm.deposit(liquidityBalance)

        const alicesDeposits = await farm.balanceOf(alice.address)
        const totalDepositsAfter = await farm.totalDeposits()
        // check if alice's deposits are correct
        expect(totalDepositsAfter.sub(totalDepositsBefore)).to.eq(alicesDeposits)
    })


    it("test deposit with unclaimed rewards", async () => {
        const dexStrategyV6 = await deployV6({reinvestRewardBips: 500})
        const farm = dexStrategyV6.connect(alice)        
        await fundStrategy(bob, farm, ethers.utils.parseEther("100"))
        const totalDepositsBefore = await farm.totalDeposits()
        
        await oneWeek()
        
        await farm.connect(owner)
            .updateMaxTokensToDepositWithoutReinvest(ONE_EXP_17)
        const maxTokensToDepositWithoutReinvest = await farm.MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST()
        expect(maxTokensToDepositWithoutReinvest).to.eq(ONE_EXP_17)

        const rewardsBefore = await farm.checkReward()
        expect(rewardsBefore).to.be.gt(maxTokensToDepositWithoutReinvest)
        
        // second deposit triggers reinvest
        const alicesDeposits = await fundStrategy(alice, farm, ethers.utils.parseEther("10"))
        
        const totalDepositsAfter = await farm.totalDeposits()
        // total deposits increased by staking rewards
        expect(totalDepositsAfter).to.be.gt(totalDepositsBefore.add(alicesDeposits))
    })


    it("test withdraw", async () => {
        const dexStrategyV6 = await deployV6()
        const farm = dexStrategyV6.connect(alice)
        
        const deposits = await fundStrategy(alice, farm, ethers.utils.parseEther("10"))

        await oneWeek()
        await farm.withdraw(deposits)

        expect(await farm.balanceOf(alice.address)).to.eq(0)
        // all deposits went to alice
        expect(await farm.totalDeposits()).to.eq(0)
    })

    it("test reinvest", async () => {
        const minTokenToReinvest = ethers.utils.parseUnits("1.0", 15)
        const dexStrategyV6 = await deployV6({reinvestRewardBips: 500, minTokenToReinvest})
        const pngToken = await getTokenContract(tokens.PNG, alice)
        const farm = dexStrategyV6.connect(alice)
        const bobsDeposits = await fundStrategy(bob, farm, ethers.utils.parseEther("100"))
        const totalDepositsBefore = await farm.totalDeposits()
        expect(totalDepositsBefore).to.be.gt(0)
        expect(bobsDeposits).to.be.gt(0)

        await oneWeek()

        // alice has no PNG rewards before reinvesting
        expect(await pngToken.balanceOf(alice.address)).to.be.eq(0)
        // reinvesting is possible
        expect(await farm.checkReward()).to.be.gt(minTokenToReinvest)
        
        await farm.reinvest()
        
        const totalDepositsAfter = await farm.totalDeposits()
        // check reinvestment
        expect(totalDepositsAfter).to.be.gt(totalDepositsBefore)
        expect(await farm.checkReward()).to.lt(minTokenToReinvest)
        // some rewards went to alice
        expect(await pngToken.balanceOf(alice.address)).to.be.gt(0)

    })
})


async function deployV6(
    { 
        name = "TestContract",
        depositToken = pairs.AVAX.PNG,
        rewardToken = tokens.PNG,
        stakingContract = stakingRewards.PGL.AVAX.PNG,
        swapPair0 = ethers.constants.AddressZero,
        swapPair1 = ethers.constants.AddressZero,
        owner = null,
        minTokenToReinvest = 0,
        adminFee = 0,
        devFee = 0,
        reinvestRewardBips = 0,
    }={}) {
    const dexStrategyV6Factory = await ethers.getContractFactory("DexStrategyV6")
    if (owner === null) owner = (await accountsFixture()).owner.address

    dexStrategyV6 = await dexStrategyV6Factory.deploy(
        name,
        depositToken, // deposit token
        rewardToken, // reward token
        stakingContract, // staking contract
        swapPair0, // swap pair 0
        swapPair1, // swap pair 1
        owner, // 
        minTokenToReinvest, // min tokens to reinvest
        adminFee, // admin fee
        devFee, // dev fee
        reinvestRewardBips // reinvest reward bips
    )
    return dexStrategyV6
}

async function fundStrategy(signer, strategy, amount=ethers.utils.parseEther("10")) {
    const depositToken = await strategy.depositToken()
    const liquidityToken = await getTokenContract(depositToken, signer)
    const liquidityBalance = await fundLiquidityToken(signer, liquidityToken.address, amount)
    const depositsBefore = await strategy.balanceOf(signer.address)
    await liquidityToken.approve(strategy.address, liquidityBalance)
    await strategy.connect(signer).deposit(liquidityBalance)
    return (await strategy.balanceOf(signer.address)).sub(depositsBefore)
}