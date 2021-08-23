const { SignerWithAddress } = require("@nomiclabs/hardhat-ethers/signers");
const { expect } = require("chai");
const { BigNumber, Contract } = require("ethers");
const { ethers } = require("hardhat");
const { tokens, pairs } = require("./fixtures");


function getAmountOut(amountIn, reserveIn, reserveOut) {
    const amountInWithFee = amountIn.mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    return numerator.div(denominator);
}

async function getTokenContract(tokenAddress) {
    return await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", tokenAddress)
}

async function getPairContract(pairAddress) {
    return await ethers.getContractAt("IPair", pairAddress)
}

async function getWAVAXContract() {
    return await ethers.getContractAt("IWAVAX", tokens.WAVAX)
}

async function fundWAVAX(account, amount) {
    const WAVAX = await getWAVAXContract()
    await WAVAX.connect(account).deposit({value: amount})
    expect(await WAVAX.balanceOf(account.address)).to.gte(amount)
}

async function fundToken(account, tokenToFund, amountAvax) {
    const WAVAX = (await getWAVAXContract()).connect(account)
    //we're already funded in this case
    if (tokenToFund == WAVAX.address) return amountAvax

    const tokenContract = await getTokenContract(tokenToFund)
    const tokenSymbol = await tokenContract.symbol()
    
    if (!(tokenSymbol in pairs.AVAX)) throw `No valid pair for AVAX-${tokenSymbol} required to fund the account with WAVAX`
    const pairAddress = pairs.AVAX[tokenSymbol]
    const fundPairContract = (await getPairContract(pairAddress)).connect(account)
    let [reserves0, reserves1] = await fundPairContract.getReserves()
    const token0 = await fundPairContract.token0()
    if (token0 != tokens.WAVAX) [reserves0, reserves1] = [reserves1, reserves0]
    expect(await WAVAX.balanceOf(account.address)).to.gte(amountAvax)
    await WAVAX.transfer(fundPairContract.address, amountAvax)
    let amountOut0 = BigNumber.from(0)
    let amountOut1 = getAmountOut(amountAvax, reserves0, reserves1)
    if (token0 != tokens.WAVAX) [amountOut0, amountOut1] = [amountOut1, amountOut0]
    expect(amountOut0.add(amountOut1), "Not enough AVAX used, value is 0 due to rounding issues, use a bigger amountAvax").to.not.equal(0)
    await fundPairContract.swap(amountOut0, amountOut1, account.address, [])
    return await tokenContract.balanceOf(account.address)
}

async function fundLiquidityToken(account, pairAddress, amountAvax) {
    amountAvax = BigNumber.from(amountAvax)
    const pairContract = await getPairContract(pairAddress, account)
    await fundWAVAX(account, amountAvax)
    let pairToken0 = (await getTokenContract(await pairContract.token0())).connect(account)
    let pairToken1 = (await getTokenContract(await pairContract.token1())).connect(account)
    let amountToken0 = await fundToken(account, pairToken0.address, amountAvax.div(2))
    let amountToken1 = await fundToken(account, pairToken1.address, amountAvax.div(2))
    expect(await pairToken0.balanceOf(account.address)).to.gte(amountToken0)
    expect(await pairToken1.balanceOf(account.address)).to.gte(amountToken1)
    
    // funds the liquidity token
    await pairToken0.transfer(pairContract.address, amountToken0)
    await pairToken1.transfer(pairContract.address, amountToken1)
    await pairContract.mint(account.address)
    let liquidityAmount = await pairContract.balanceOf(account.address)
    expect(liquidityAmount).to.gt(0)
    return liquidityAmount
}

async function fundStrategy(signer, strategy, amount = ethers.utils.parseEther("10")) {
    const depositToken = await strategy.depositToken()
    const depositTokenContract = (await getTokenContract(depositToken)).connect(signer)
    const liquidity = await fundLiquidityToken(signer, depositTokenContract.address, amount)
    const depositsBefore = await strategy.balanceOf(signer.address)
    await depositTokenContract.approve(strategy.address, liquidity)
    await strategy.connect(signer).deposit(liquidity)
    return (await strategy.balanceOf(signer.address)).sub(depositsBefore)
}


function getDeadline() {
    return Math.floor(Date.now() / 1000) + 60 * 20 * 4;
}

// export async function checkDust(tokens: string[], addressToCheck: string, expectAmount: number) {
//     for(let i = 0; i < tokens.length; i++) {
//         let token = await getTokenContract(tokens[i])
//         expect(await token.balanceOf(addressToCheck)).to.equal(expectAmount)
//     }
// }

async function oneWeek() {
    await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine")
}

module.exports = {
    fundWAVAX,
    fundToken,
    fundLiquidityToken,
    fundStrategy,
    getWAVAXContract,
    getPairContract,
    getTokenContract,
    getDeadline,
    oneWeek
}



