const { expect } = require("chai");
const fs = require("fs");
const { ethers, network, deployments } = require("hardhat");
const { accounts, accountsFixture, tokens, pairs, stakingRewards } = require("./fixtures");
const { fundLiquidityToken, fundWAVAX, fundToken, getTokenContract, getPairContract, oneWeek, getWAVAXContract } = require("./utils");

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

    describe("Test attributes", async () => {
        let dexStrategyV6 = await deployStrategy(
            {
                minTokenToReinvest: ONE_EXP_17,
                adminFee: 100,
                devFee: 100,
                reinvestRewardBips: 500
            }
        )

        it('Owner is set', async () => {
            expect(await dexStrategyV6.owner()).to.equal(owner.address)
        })

        it('Set correctly the MIN_TOKENS_TO_REINVEST', async () => {
            expect(await dexStrategyV6.MIN_TOKENS_TO_REINVEST()).to.eq(ONE_EXP_17)
        })

        it('Set correctly the ADMIN_FEE_BIPS', async () => {
            expect(await dexStrategyV6.ADMIN_FEE_BIPS()).to.eq(100)
        })

        it('Set correctly the DEV_FEE_BIPS', async () => {
            expect(await dexStrategyV6.DEV_FEE_BIPS()).to.eq(100)
        })

        it('Set correctly the REINVEST_REWARD_BIPS', async () => {
            expect(await dexStrategyV6.REINVEST_REWARD_BIPS()).to.eq(500)
        })

        it('Set correctly the devAddr', async () => {
            expect(await dexStrategyV6.devAddr()).to.equal(deployer.address)
        })

        it('Set correctly the allowance on the deposit token', async () => {
            const depositToken = await getTokenContract(pairs.AVAX.PNG)
            expect(await depositToken.allowance(dexStrategyV6.address, stakingRewards.PGL.AVAX.PNG)).to.eq(ethers.constants.MaxUint256)
        })

        it('DEPOSITS_ENABLED is true', async () => {
            expect(await dexStrategyV6.DEPOSITS_ENABLES()).to.be.true
        })

        it("MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST is zero", async () => {
            expect(await dexStrategyV6.MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST())
                .to.be.eq(0)
        })

    })

    describe("Test Owner functionallity", async () => {
        let dexStrategyV6;        
        beforeEach(async () => {
            dexStrategyV6 = await deployStrategy(
                {
                    owner: owner.address
                }
            )
            dexStrategyV6 = dexStrategyV6.connect(owner)
        })

        it("revoke allowance", async () => {
            await dexStrategyV6.revokeAllowance(pairs.AVAX.PNG, stakingRewards.PGL.AVAX.PNG)
            let depositToken = await getTokenContract(pairs.AVAX.PNG)
            expect(await depositToken.allowance(dexStrategyV6.address, stakingRewards.PGL.AVAX.PNG)).to.eq(0)
            await depositToken.setAllowance
        })

        it("Set MIN_TOKENS_TO_REINVEST", async () =>  {
            await dexStrategyV6.updateMinTokensToReinvest("1000")
            expect(await dexStrategyV6.MIN_TOKENS_TO_REINVEST()).to.be.eq("1000")
        })

        it("Set MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST", async () => {
            await dexStrategyV6.updateMaxTokensToDepositWithoutReinvest("1000")
            expect(await dexStrategyV6.MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST()).to.be.eq("1000")
        })

        it("Set DEV_FEE_BIPS", async () => {
            await dexStrategyV6.updateDevFee("200")
            expect(await dexStrategyV6.DEV_FEE_BIPS()).to.be.eq("200")
        })

        it("Set ADMIN_FEE_BIPS", async () => {
            await dexStrategyV6.updateAdminFee("200")
            expect(await dexStrategyV6.ADMIN_FEE_BIPS()).to.be.eq("200")
        })

        it("Set REINVEST_REWARD_BIPS", async () => {
            await dexStrategyV6.updateReinvestReward("500")
            expect(await dexStrategyV6.REINVEST_REWARD_BIPS()).to.be.eq("500")
        })

        it("Set DEPOSITS_ENABLED", async () => {
            await dexStrategyV6.updateDepositsEnabled(false)
            expect(await dexStrategyV6.DEPOSITS_ENABLED()).to.be.false
        })

        it("set devAddr", async () => {
            await dexStrategyV6.connect(deployer).updateDevAddr(alice.address)
            expect(await dexStrategyV6.devAddr()).to.be.equal(alice.address)
        })

        it("recoverERC20 can recover deposit pair", async () => {
            const amount = ethers.utils.parseEther("100")
            const WAVAXContract = (await getWAVAXContract()).connect(alice)
            await fundWAVAX(alice, amount)
            await WAVAXContract.transfer(dexStrategyV6.address, amount)
            expect(await WAVAXContract.balanceOf(dexStrategyV6.address)).to.be.gt(0)
            await dexStrategyV6.recoverERC20(WAVAXContract.address, amount)
            expect(await WAVAXContract.balanceOf(dexStrategyV6.address)).to.eq(0)
            expect(await WAVAXContract.balanceOf(owner.address)).to.be.eq(amount)
        })

    })

    it("Deposit fails if DEPOSITS_ENABLED is false", async () => {})

    it("Can deploy", async () => {
        const dexStrategyV6 = await deployStrategy()
        expect(await dexStrategyV6.stakingContract()).to.be.equal(stakingRewards.PGL.AVAX.PNG)
        expect(await dexStrategyV6.owner()).to.be.equal(owner.address)
    })

    it("test deposit", async () => {
        const dexStrategyV6 = await deployStrategy()
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
        const dexStrategyV6 = await deployStrategy({ reinvestRewardBips: 500 })
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
        const dexStrategyV6 = await deployStrategy()
        const farm = dexStrategyV6.connect(alice)

        const deposits = await fundStrategy(alice, farm, ethers.utils.parseEther("10"))

        await oneWeek()
        await farm.withdraw(deposits)

        expect(await farm.balanceOf(alice.address)).to.eq(0)
        // all deposits went to alice
        expect(await farm.totalDeposits()).to.eq(0)
    })

    it("test reinvest", async () => {
        const minTokenToReinvest = ethers.utils.parseUnits("1.0", 14)
        const dexStrategyV6 = await deployStrategy({ reinvestRewardBips: 500, minTokenToReinvest })
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


async function deployStrategy(
    {
        strategy = "DexStrategyV6",
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
    } = {}) {
    const { owner: _owner, deployer } = await accountsFixture()
    const strategyFactory = await ethers.getContractFactory(strategy, deployer)

    if (owner === null) owner = _owner.address

    const _strategy = await strategyFactory.deploy(
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
    return _strategy
}

async function fundStrategy(signer, strategy, amount = ethers.utils.parseEther("10")) {
    const depositToken = await strategy.depositToken()
    const depositTokenContract = (await (await getTokenContract(depositToken)).connect(signer)
    const liquidity = await fundLiquidityToken(signer, depositTokenContract.address, amount)
    const depositsBefore = await strategy.balanceOf(signer.address)
    await depositTokenContract.approve(strategy.address, liquidity)
    await strategy.connect(signer).deposit(liquidity)
    return (await strategy.balanceOf(signer.address)).sub(depositsBefore)
}