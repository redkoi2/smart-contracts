const { expect } = require("chai");
const fs = require("fs");
const { ethers, network, deployments } = require("hardhat");
const { accounts, accountsFixture, tokens, pairs, stakingRewards } = require("./fixtures");
const { fundLiquidityToken, fundWAVAX, fundToken, fundStrategy, getTokenContract, getPairContract, oneWeek, getWAVAXContract } = require("./utils");

const BigNumber = ethers.BigNumber
const ONE_EXP_17 = BigNumber.from("10000000000000000");


describe("Test YakStrategies", function () {

    const testCases = [
        {
            name: "Yield Yak: PGL AVAX-PNG",
            depositToken: pairs.AVAX.PNG,
            rewardToken: tokens.PNG,
            stakingContract: stakingRewards.PGL.AVAX.PNG,
            deploy: deployDexStrategyV6
        },
        // {
        //     name: "Yield Yak: PGL WETH.e-AVAX",
        //     depositToken: pairs.AVAX.ETH,
        //     rewardToken: tokens.PNG,
        //     stakingContract: stakingRewards.PGL.AVAX["WETH.e"],
        //     swapPair0: pairs.AVAX.PNG,
        //     swapPair1: pairs.PNG["WETH.e"],
        //     deploy: deployDexStrategyV6
        // },
        {
            name: "Yield Yak: PGL PNG-SNOB",
            depositToken: pairs.PNG.SNOB,
            rewardToken: tokens.PNG,
            stakingContract: stakingRewards.PGL.PNG.SNOB,
            deploy: deployDexStrategyV6
        },
        {
            name: "Yield Yak: PGL AVAX-VSO",
            depositToken: pairs.AVAX.VSO,
            rewardToken: tokens.PNG,
            stakingContract: stakingRewards.PGL.AVAX.VSO,
            swapPair0: pairs.PNG.VSO,
            swapPair1: pairs.AVAX.PNG,
            deploy: deployDexStrategyV6
        },
    ]

    testCases.forEach(testCase => {
        let owner;
        let deployer;
        let alice;
        let bob;

        beforeEach(async () => {
            ({ owner, deployer, alice, bob } = await accountsFixture())
        })

        describe(`Test ${testCase.name} interface`, async () => {

            describe("Test basic functionality", async () => {
                let strategy;
                beforeEach(async () => {
                    strategy = await testCase.deploy(testCase)
                    await strategy.connect(owner).updateMinTokensToReinvest(ONE_EXP_17)
                    await strategy.connect(owner).updateAdminFee(100)
                    await strategy.connect(owner).updateDevFee(100)
                    await strategy.connect(owner).updateReinvestReward(500)

                })

                it("Can deploy", async () => {
                    expect(await strategy.stakingContract()).to.equal(testCase.stakingContract)
                    expect(await strategy.owner()).to.equal(owner.address)
                })

                it('Owner is set', async () => {
                    expect(await strategy.owner()).to.equal(owner.address)
                })

                it('Set correctly the MIN_TOKENS_TO_REINVEST', async () => {
                    expect(await strategy.MIN_TOKENS_TO_REINVEST()).to.eq(ONE_EXP_17)
                })

                it('Set correctly the ADMIN_FEE_BIPS', async () => {
                    expect(await strategy.ADMIN_FEE_BIPS()).to.eq(100)
                })

                it('Set correctly the DEV_FEE_BIPS', async () => {
                    expect(await strategy.DEV_FEE_BIPS()).to.eq(100)
                })

                it('Set correctly the REINVEST_REWARD_BIPS', async () => {
                    expect(await strategy.REINVEST_REWARD_BIPS()).to.eq(500)
                })

                it('Set correctly the devAddr', async () => {
                    expect(await strategy.devAddr()).to.equal(deployer.address)
                })

                it('Set correctly the allowance on the deposit token', async () => {
                    const depositToken = await getTokenContract(testCase.depositToken)
                    expect(await depositToken.allowance(strategy.address, testCase.stakingContract)).to.eq(ethers.constants.MaxUint256)
                })

                it('DEPOSITS_ENABLED is true', async () => {
                    expect(await strategy.DEPOSITS_ENABLED()).to.be.true
                })

                it("MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST is zero", async () => {
                    expect(await strategy.MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST())
                        .to.be.eq(0)
                })


                it("getSharesForDepositTokens works", async () => {
                    const amount = ethers.utils.parseEther("100")
                    const sharesBefore = await strategy.getSharesForDepositTokens(amount)
                    expect(sharesBefore).to.eq(amount)

                    const shares = await fundStrategy(alice, strategy, amount)
                    const totalDeposits = await strategy.totalDeposits()
                    const sharesAfter = await strategy.getSharesForDepositTokens(totalDeposits)
                    expect(shares).to.eq(sharesAfter)
                })

                it("getDepositTokensForShares works", async () => {
                    const amount = ethers.utils.parseEther("100")
                    const depositsBefore = await strategy.getDepositTokensForShares(amount)
                    expect(depositsBefore).to.eq(0)

                    const shares = await fundStrategy(alice, strategy, amount)
                    const totalDeposits = await strategy.totalDeposits()
                    const depositsAfter = await strategy.getDepositTokensForShares(shares)
                    expect(totalDeposits).to.eq(depositsAfter)
                })

            })

            describe("Test Owner functionality", async () => {
                let strategy;
                beforeEach(async () => {
                    strategy = await testCase.deploy(
                        {
                            ...testCase,
                            owner: owner.address
                        }
                    )
                    strategy = strategy.connect(owner)
                })

                it("Revoke allowance", async () => {
                    await strategy.revokeAllowance(testCase.depositToken, testCase.stakingContract)
                    let depositToken = await getTokenContract(testCase.depositToken)
                    expect(await depositToken.allowance(strategy.address, testCase.stakingContract)).to.eq(0)
                })

                it("Set MIN_TOKENS_TO_REINVEST", async () => {
                    await strategy.updateMinTokensToReinvest("1000")
                    expect(await strategy.MIN_TOKENS_TO_REINVEST()).to.be.eq("1000")
                })

                it("Set MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST", async () => {
                    await strategy.updateMaxTokensToDepositWithoutReinvest("1000")
                    expect(await strategy.MAX_TOKENS_TO_DEPOSIT_WITHOUT_REINVEST()).to.be.eq("1000")
                })

                it("Set DEV_FEE_BIPS", async () => {
                    await strategy.updateDevFee("200")
                    expect(await strategy.DEV_FEE_BIPS()).to.be.eq("200")
                })

                it("Set ADMIN_FEE_BIPS", async () => {
                    await strategy.updateAdminFee("200")
                    expect(await strategy.ADMIN_FEE_BIPS()).to.be.eq("200")
                })

                it("Set REINVEST_REWARD_BIPS", async () => {
                    await strategy.updateReinvestReward("500")
                    expect(await strategy.REINVEST_REWARD_BIPS()).to.be.eq("500")
                })

                it("Set DEPOSITS_ENABLED", async () => {
                    await strategy.updateDepositsEnabled(false)
                    expect(await strategy.DEPOSITS_ENABLED()).to.be.false
                })

                it("Set devAddr", async () => {
                    await strategy.connect(deployer).updateDevAddr(alice.address)
                    expect(await strategy.devAddr()).to.be.equal(alice.address)
                })

                it("Can recover deposit pair with recoverERC20", async () => {
                    const amount = ethers.utils.parseEther("100")
                    const WAVAXContract = (await getWAVAXContract()).connect(alice)
                    await fundWAVAX(alice, amount)
                    await WAVAXContract.transfer(strategy.address, amount)
                    expect(await WAVAXContract.balanceOf(strategy.address)).to.be.gt(0)
                    await strategy.recoverERC20(WAVAXContract.address, amount)
                    expect(await WAVAXContract.balanceOf(strategy.address)).to.eq(0)
                    expect(await WAVAXContract.balanceOf(owner.address)).to.be.eq(amount)
                })
            })


            describe("Test interface", async () => {
                let strategy;
                beforeEach(async () => {
                    strategy = await testCase.deploy(testCase)
                })

                it("Deposit", async () => {
                    strategy = strategy.connect(alice)
                    const depositTokenAddress = await strategy.depositToken()
                    const liquidityToken = (await getTokenContract(depositTokenAddress)).connect(alice)
                    const liquidityBalance = await fundLiquidityToken(alice, liquidityToken.address, ethers.utils.parseEther("10"))
                    const totalDepositsBefore = await strategy.totalDeposits()

                    await liquidityToken.approve(strategy.address, liquidityBalance)
                    await strategy.deposit(liquidityBalance)

                    const aliceDeposits = await strategy.balanceOf(alice.address)
                    const totalDepositsAfter = await strategy.totalDeposits()
                    // check if alice's deposits are correct
                    expect(totalDepositsAfter.sub(totalDepositsBefore)).to.eq(aliceDeposits)
                })

                it("Use depositFor", async () => {
                    strategy = strategy.connect(alice)
                    const depositTokenAddress = await strategy.depositToken()
                    const depositToken = (await getTokenContract(depositTokenAddress)).connect(alice)
                    const aliceBalance = await fundLiquidityToken(alice, depositToken.address, ethers.utils.parseEther("100"))
                    const shares = await strategy.getSharesForDepositTokens(aliceBalance)
                    await depositToken.approve(strategy.address, aliceBalance)
                    await strategy.depositFor(bob.address, aliceBalance)
                    expect(await strategy.balanceOf(alice.address)).to.eq(0)
                    expect(await strategy.balanceOf(bob.address)).to.eq(shares)
                })

                it("Deposit fails if DEPOSITS_ENABLED is false", async () => {
                    strategy = strategy.connect(alice)
                    await strategy.connect(owner).updateDepositsEnabled(false)
                    const depositTokenAddress = await strategy.depositToken()
                    const liquidityToken = (await getTokenContract(depositTokenAddress)).connect(alice)
                    const liquidityBalance = await fundLiquidityToken(alice, liquidityToken.address, ethers.utils.parseEther("10"))

                    await liquidityToken.approve(strategy.address, liquidityBalance)
                    const tx = await strategy.deposit(liquidityBalance)
                    expect(await successful(tx)).to.be.false
                })

                it("test deposit with unclaimed rewards", async () => {
                    await strategy.connect(owner).updateReinvestReward(500)
                    strategy = strategy.connect(alice)
                    await fundStrategy(bob, strategy, ethers.utils.parseEther("100"))
                    const totalDepositsBefore = await strategy.totalDeposits()
                    await oneWeek()

                    await strategy.connect(owner).updateMaxTokensToDepositWithoutReinvest(1)

                    const rewardsBefore = await strategy.checkReward()
                    expect(rewardsBefore).to.be.gt(0)

                    // second deposit triggers reinvest
                    const aliceDeposits = await fundStrategy(alice, strategy, ethers.utils.parseEther("10"))

                    const totalDepositsAfter = await strategy.totalDeposits()
                    // total deposits increased by staking rewards
                    expect(totalDepositsAfter).to.be.gt(totalDepositsBefore.add(aliceDeposits))
                })


                it("Can withdraw full amount", async () => {
                    strategy = strategy.connect(alice)
                    const deposits = await fundStrategy(alice, strategy, ethers.utils.parseEther("10"))

                    await oneWeek()
                    await strategy.withdraw(deposits)

                    expect(await strategy.balanceOf(alice.address)).to.eq(0)
                    // all deposits went to alice
                    expect(await strategy.totalDeposits()).to.eq(0)
                })

                it("withdraw only half", async () => {
                    strategy = strategy.connect(alice)
                    const deposits = await fundStrategy(alice, strategy, ethers.utils.parseEther("10"))
                    await strategy.withdraw(deposits.div(2))
                    expect(await strategy.balanceOf(alice.address)).to.eq(deposits.sub(deposits.div(2)))
                })

                it("withdraw too much", async () => {
                    strategy = strategy.connect(alice)
                    const deposits = await fundStrategy(alice, strategy, ethers.utils.parseEther("10"))
                    const tx = await strategy.withdraw(deposits.add(1))
                    expect(await successful(tx)).to.be.false
                })


                it("Test reinvest", async () => {
                    strategy = strategy.connect(alice)
                    await strategy.connect(owner).updateReinvestReward(500)
                    const rewardTokenAddress = await strategy.rewardToken()
                    const rewardToken = (await getTokenContract(rewardTokenAddress)).connect(alice)
                    const bobsDeposits = await fundStrategy(bob, strategy, ethers.utils.parseEther("100"))
                    const totalDepositsBefore = await strategy.totalDeposits()
                    expect(totalDepositsBefore).to.be.gt(0)
                    expect(bobsDeposits).to.be.gt(0)

                    await oneWeek()

                    // alice has no PNG rewards before reinvesting
                    expect(await rewardToken.balanceOf(alice.address)).to.be.eq(0)
                    // reinvesting is possible
                    const rewards = await strategy.checkReward()
                    expect(rewards).to.be.gt(0)
                    await strategy.connect(owner).updateMinTokensToReinvest(rewards)
                    const minTokenToReinvest = await strategy.MIN_TOKENS_TO_REINVEST()
                    expect(rewards).to.be.eq(minTokenToReinvest)
                    await strategy.reinvest()

                    // check reinvestment
                    const totalDepositsAfter = await strategy.totalDeposits()
                    expect(totalDepositsAfter).to.be.gt(totalDepositsBefore)
                    expect(await strategy.checkReward()).to.lt(minTokenToReinvest)
                    // some rewards went to alice
                    expect(await rewardToken.balanceOf(alice.address)).to.be.gt(0)
                })

                it("reinvest fails if rewards are less than MIN_TOKENS_TO_REINVEST", async () => {
                    strategy = strategy.connect(alice)
                    await strategy.connect(owner).updateReinvestReward(500)
                    await fundStrategy(bob, strategy, ethers.utils.parseEther("100"))
                    await oneWeek()

                    const rewards = await strategy.checkReward()
                    expect(rewards).to.be.gt(0)
                    await strategy.connect(owner).updateMinTokensToReinvest(rewards + 10)

                    const tx = await strategy.reinvest()
                    expect(await successful(tx)).to.be.false
                })

                it("checkReward does not return zero", async () => {
                    await fundStrategy(bob, strategy, ethers.utils.parseEther("100"))
                    await oneWeek()
                    expect(await strategy.checkReward()).to.be.gt(0)
                })

                it("estimateDeployedBalance does not return zero", async () => {
                    await fundStrategy(bob, strategy, ethers.utils.parseEther("100"))
                    expect(await strategy.estimateDeployedBalance()).to.be.gt(0)
                })

                it("rescueDeployedFunds works", async () => {
                    strategy = strategy.connect(owner)
                    const balance = await fundStrategy(bob, strategy, ethers.utils.parseEther("100"))
                    const depositTokenAddress = await strategy.depositToken()
                    const depositToken = (await getTokenContract(depositTokenAddress)).connect(alice)
                    expect(await depositToken.balanceOf(strategy.address)).to.be.eq(0)
                    await strategy.rescueDeployedFunds(0, true)
                    expect(await depositToken.balanceOf(strategy.address)).to.be.eq(balance)
                    expect(await strategy.DEPOSITS_ENABLED()).to.be.false
                })

                it("rescueDeployedFunds fails if minReturnAmountAccepted is too big", async () => {
                    strategy = strategy.connect(owner)
                    const balance = await fundStrategy(bob, strategy, ethers.utils.parseEther("100"))
                    const tx = await strategy.rescueDeployedFunds(balance.add(1), true)
                    expect(await successful(tx)).to.be.false
                })

                it("estimateReinvestReward returns right amount", async () => {
                    expect(await strategy.estimateReinvestReward()).to.eq(0)
                    await fundStrategy(bob, strategy, ethers.utils.parseEther("100"))
                    await oneWeek()
                    await strategy.connect(owner).updateReinvestReward(500)
                    expect(await strategy.estimateReinvestReward()).to.be.gt(0)
                })
            })
        })
    })
})


async function deployDexStrategyV6(
    {
        name,
        depositToken,
        rewardToken,
        stakingContract,
        swapPair0 = ethers.constants.AddressZero,
        swapPair1 = ethers.constants.AddressZero,
        owner = null,
        minTokenToReinvest = 0,
        adminFee = 0,
        devFee = 0,
        reinvestRewardBips = 0,
    } = {}) {
    const { owner: _owner, deployer } = await accountsFixture()
    const strategyFactory = await ethers.getContractFactory("DexStrategyV6", deployer)

    if (owner === null) owner = _owner.address

    const _strategy = await strategyFactory.deploy(
        name,
        depositToken,
        rewardToken,
        stakingContract,
        swapPair0,
        swapPair1,
        owner,
        minTokenToReinvest,
        adminFee,
        devFee,
        reinvestRewardBips
    )
    return _strategy
}



async function successful(tx) {
    const receipt = await tx.wait().catch(e => e.receipt)
    return receipt.status == 1
}