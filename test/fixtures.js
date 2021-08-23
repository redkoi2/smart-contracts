const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require("hardhat");


module.exports.accountsFixture = deployments.createFixture(async ({ethers, deployments}) => {
    const signers = await ethers.getSigners()
    const owner = signers[0]
    const deployer = signers[1]
    const alice = signers[5]
    const bob = signers[6]
    return {owner, deployer, alice, bob}
})


module.exports.tokens = {
    "PNG": "0x60781c2586d68229fde47564546784ab3faca982",
    "WAVAX": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    "WETH.e": "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
    "SNOB": "0xC38f41A296A4493Ff429F1238e030924A1542e50",
    "VSO": "0x846D50248BAf8b7ceAA9d9B53BFd12d7D7FBB25a"
}

module.exports.stakingRewards = {
    "PGL": {
        "AVAX": {
            "PNG": "0x574d3245e36Cf8C9dc86430EaDb0fDB2F385F829",
            "YAK": "0x0cf605484a512d3f3435fed77ab5ddc0525daf5f",
            "WETH.e": "0x830A966B9B447c9B15aB24c0369c4018E75F31C9",
            "VSO": "0xf2b788085592380bfCAc40Ac5E0d10D9d0b54eEe"
        },
        "PNG": {
            "SNOB": "0x08B9A023e34Bad6Db868B699fa642Bf5f12Ebe76"
        }
    }
}

module.exports.pairs = {
    "AVAX": {
        "PNG": "0xd7538cABBf8605BdE1f4901B47B8D42c61DE0367",
        "YAK": "0xd2f01cd87a43962fd93c21e07c1a420714cc94c9",
        "WETH.e": "0x7c05d54fc5CB6e4Ad87c6f5db3b807C94bB89c52",
        "SNOB": "0xa1C2c3B6b120cBd4Cec7D2371FFd4a931A134A32",
        "VSO": "0x2b532bC0aFAe65dA57eccFB14ff46d16a12de5E6"
    },
    "PNG": {
        "WETH.e": "0xcf35400A595EFCF0Af591D3Aeb5a35cBCD120d54",
        "SNOB": "0x97B4957df08E185502A0ac624F332c7f8967eE8D",
        "VSO": "0x9D472e21f6589380B21C42674B3585C47b74c891"
    }
}

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
