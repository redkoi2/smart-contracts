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
    PNG: "0x60781c2586d68229fde47564546784ab3faca982",
    WAVAX: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
}

module.exports.stakingRewards = {
    "PGL": {
        "AVAX": {
            "PNG": "0x574d3245e36Cf8C9dc86430EaDb0fDB2F385F829"
        }
    }
}

module.exports.pairs = {
    "AVAX": {
        "PNG": "0xd7538cabbf8605bde1f4901b47b8d42c61de0367",
        "ETH": "0x1acf1583bebdca21c8025e172d8e8f2817343d65",
        "WETH": "0x1acf1583bebdca21c8025e172d8e8f2817343d65",
        "WBTC": "0x7a6131110b82dacbb5872c7d352bfe071ea6a17c",
        "LINK": "0xbbc7fff833d27264aac8806389e02f717a5506c9",
        "USDT": "0x9ee0a4e21bd333a6bb2ab298194320b8daa26516",
        "SUSHI": "0xd8b262c0676e13100b33590f10564b46eef652ad",
        "DAI": "0x17a2e8275792b4616befb02eb9ae699aa0dcb94b",
        "AAVE": "0x5f233a14e1315955f48c5750083d9a44b0df8b50",
        "XAVA": "0x42152bdd72de8d6767fe3b4e17a221d6985e8b25",
        "UNI": "0x92dc558cb9f8d0473391283ead77b79b416877ca",
        "1INCH": "0xe6c5e55c12de2e59ebb5f9b0a19bc3fd71500db3",
        "BAT": "0x9f471183fa95d26b08daf6c57eb45b8149dd6b5f",
        "BUSD": "0x1d704f88fbdfff582bc46167e450f6f8dab83e64",
        "GRT": "0xc005f8320dc4cd5ba32aa441b708c83eef8f64e9",
        "SNX": "0x757c99fcd02da951582b47146f7bd75ae11f6f43",
        "UMA": "0x453fae08f850056c9eed191fce71a60ccc22b31a",
        "YFI": "0x7a886b5b2f24ed0ec0b3c4a17b930e16d160bd17"
    },
    "PNG": {
        "ETH": "0x53b37b9a6631c462d74d65d61e1c056ea9daa637",
        "WETH": "0x53b37b9a6631c462d74d65d61e1c056ea9daa637",
        "LINK": "0x7313835802c6e8ca2a6327e6478747b71440f7a4",
        "SNOB": "0x97b4957df08e185502a0ac624f332c7f8967ee8d",
        "USDT": "0xe8acf438b10a2c09f80aef3ef2858f8e758c98f9",
        "PEFI": "0x1bb5541eccda68a352649954d4c8ece6ad68338d",
        "AAVE": "0x0025cebd8289bbe0a51a5c85464da68cbc2ec0c4",
        "WBTC": "0xf372ceae6b2f4a2c4a6c0550044a7eab914405ea"
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
