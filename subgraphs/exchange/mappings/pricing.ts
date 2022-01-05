/* eslint-disable prefer-const */
import { BigDecimal, Address } from "@graphprotocol/graph-ts/index";
import { Pair, Token, Bundle } from "../generated/schema";
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from "./utils";

import {
  ethereum,
  BigInt
} from "@graphprotocol/graph-ts";

let CNO_ADDRESS = "0x322e21dcAcE43d319646756656b29976291d7C76";
let USDC_CNO_PAIR = "0x50af1c38af0481c9d06f72a045274201781773ae"; // created block 589414
let USDT_CNO_PAIR = "0x07d47d97b717c6cfdb23b434273e51ac05ebb46a"; // created block 648115

export function getBnbPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdtPair = Pair.load(USDT_CNO_PAIR); // usdt is token0
  let usdcPair = Pair.load(USDC_CNO_PAIR); // usdc is token1

  if (usdcPair !== null && usdtPair !== null) {
    let totalLiquidityBNB = usdcPair.reserve0.plus(usdtPair.reserve1);
    if (totalLiquidityBNB.notEqual(ZERO_BD)) {
      let usdcWeight = usdcPair.reserve0.div(totalLiquidityBNB);
      let usdtWeight = usdtPair.reserve1.div(totalLiquidityBNB);
      return usdcPair.token1Price.times(usdcWeight).plus(usdtPair.token0Price.times(usdtWeight));
    } else {
      return ZERO_BD;
    }
  } else if (usdcPair !== null) {
    return usdcPair.token1Price;
  } else if (usdtPair !== null) {
    return usdtPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

// // token where amounts should contribute to tracked volume and liquidity
// let WHITELIST: string[] = [
//   "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WCRO
//   "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
//   "0x55d398326f99059ff775485246999027b3197955", // USDT
//   "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
//   "0x23396cf899ca06c4472205fc903bdb4de249d6fc", // UST
//   "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
//   "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // WETH
// ];

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23", // WCRO
  "0x322e21dcAcE43d319646756656b29976291d7C76", // CNO
  "0x25f0965F285F03d6F6B3B21c8EC3367412Fd0ef6", // CHRONOBAR
  "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59", // USDC
  "0x66e428c3f67a68878562e79A0234c1F83c208770", // USDT
  "0xbED48612BC69fA1CaB67052b42a95FB30C1bcFee", // SHIB
  "0xe44Fd7fCb2b1581822D0c862B68222998a0c299a", // WETH
  "0x062E66477Faf219F25D27dCED647BF57C3107d52", // WBTC
  "0xF2001B145b43032AAF5Ee2884e456CCd805F677D", // DAI
  "0xB888d8Dd1733d72681b30c00ee76BDE93ae7aa93", // ATOM
  "0x1a8E39ae59e5556B56b76fCBA98d22c9ae557396" // DOGE
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_BNB = BigDecimal.fromString("0");

/**
 * Search through graph to find derived BNB per token.
 * @todo update to be derived BNB (add stablecoin estimates)
 **/
export function findBnbPerToken(token: Token): BigDecimal {
  if (token.id == CNO_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair.token0 == token.id && pair.reserveBNB.gt(MINIMUM_LIQUIDITY_THRESHOLD_BNB)) {
        let token1 = Token.load(pair.token1);
        return pair.token1Price.times(token1.derivedBNB as BigDecimal); // return token1 per our token * BNB per token 1
      }
      if (pair.token1 == token.id && pair.reserveBNB.gt(MINIMUM_LIQUIDITY_THRESHOLD_BNB)) {
        let token0 = Token.load(pair.token0);
        return pair.token0Price.times(token0.derivedBNB as BigDecimal); // return token0 per our token * BNB per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedBNB.times(bundle.bnbPrice);
  let price1 = token1.derivedBNB.times(bundle.bnbPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedBNB.times(bundle.bnbPrice);
  let price1 = token1.derivedBNB.times(bundle.bnbPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
