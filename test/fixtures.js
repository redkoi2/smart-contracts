const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require("hardhat");

const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"


module.exports.accountFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF)
    
    const depositAmount = "100" // AVAX
    const depositTokenAddress = "0xd7538cABBf8605BdE1f4901B47B8D42c61DE0367"
    const routerAddress = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"
    
    const accounts = await ethers.getSigners();
    const alice = accounts[5]
    const bob = accounts[6]

    let aliceDeposits = await deposit(alice, depositAmount, depositTokenAddress, routerAddress)
    let bobDeposits = await deposit(bob, depositAmount, depositTokenAddress, routerAddress)

    return {
        alice: {account: alice, address: alice.address, ...aliceDeposits},
        bob: {account: bob, address: bob.address, ...bobDeposits}
    };
})

async function deposit(signer, depositAmount, depositTokenAddress, routerAddress) {
    const depositToken =  await ethers.getContractAt("IPair", depositTokenAddress, signer)
    const router = await ethers.getContractAt("IRouter", routerAddress, signer)
    const token0 = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", await depositToken.token0(), signer)
    const token1 = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", await depositToken.token1(), signer)
    const WAVAXContract = await ethers.getContractAt("IWAVAX", WAVAX, signer)

    let amount = ethers.utils.parseEther(depositAmount)
    let timestamp = (await ethers.provider.getBlock()).timestamp + 20
    let path0 = [WAVAX, token0.address]
    let path1 = [WAVAX, token1.address]
    if (token0.address == WAVAX) {
        await WAVAXContract.deposit({value: amount.div("2")})
    } else {
        let tokenAmount = ethers.utils.parseUnits(depositAmount, 18).div("2")
        let [, amountOut] = await router.getAmountsOut(tokenAmount, path0)
        await router.swapExactAVAXForTokens(amountOut, path0, signer.address, timestamp,
            {value: amount.div("2")}
        )
    }
    if (token1.address == WAVAX) {
        await WAVAXContract.deposit({value: amount.div("2")})
    } else {
        let tokenAmount = ethers.utils.parseUnits(depositAmount, 18).div("2")
        let [, amountOut] = await router.getAmountsOut(tokenAmount, path1)
        await router.swapExactAVAXForTokens(amountOut, path1, signer.address, timestamp,
            {value: amount.div("2")}
        )    
    }
    let amount0 = await token0.balanceOf(signer.address)
    let amount1 = await token1.balanceOf(signer.address)
    await token0.approve(router.address, amount0)
    await token1.approve(router.address, amount1)
    await router.addLiquidity(
        token0.address, token1.address,
        amount0, amount1,
        0, 0,
        signer.address, timestamp
    )
    let depositTokenERC20 = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", depositToken.address)
    let amountDepositToken = await depositTokenERC20.balanceOf(signer.address)

    return {
        balance: amountDepositToken,
        token: depositToken
    }
}
