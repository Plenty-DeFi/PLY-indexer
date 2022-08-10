import BigNumber from "bignumber.js";
import TzktProvider from "./TzktProvider";
import { config } from "../config";
import { Contracts, Pool } from "../types";

const TzktObj = new TzktProvider(config);

export const votingPower = async (tokenId: number, ts2: number, time: number) => {
  try {
    let factor: number = 7 * 86400;
    if (time === 0) {
      factor = 1;
    }
    // Must round down to nearest whole week
    ts2 = Math.floor(ts2 / factor) * factor;
    const ts = new BigNumber(ts2);

    const all_token_checkpoints = await TzktObj.getAllTokenCheckpoints(tokenId);

    const map1 = new Map();
    for (var x in all_token_checkpoints) {
      map1.set(all_token_checkpoints[x].key.nat_1, all_token_checkpoints[x].value);
    }

    if (ts < map1.get("1").ts) {
      throw "Too early timestamp";
    }

    const sec = await TzktObj.getNumTokenCheckpoints(tokenId);
    const last_checkpoint = map1.get(sec);

    if (ts >= last_checkpoint.ts) {
      const i_bias = new BigNumber(last_checkpoint.bias);
      const slope = new BigNumber(last_checkpoint.slope);
      const f_bias = i_bias.minus(
        ts
          .minus(last_checkpoint.ts)
          .multipliedBy(slope)
          .dividedBy(10 ** 18)
      );
      if (f_bias < new BigNumber(0)) {
        return 0;
      } else {
        return f_bias.toNumber();
      }
    } else {
      let high = Number(sec) - 2;
      let low = 0;
      let mid = 0;

      while (low < high && map1.get(mid + 1).ts != ts) {
        mid = Math.floor((low + high + 1) / 2);
        if (map1.get(mid + 1).ts < ts) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      if (map1.get(`${mid + 1}`).ts === ts) {
        return map1.get(mid + 1).bias;
      } else {
        const ob = map1.get(`${low + 1}`);
        const bias = new BigNumber(ob.bias);
        const slope = new BigNumber(ob.slope);
        const d_ts = ts.minus(ob.ts);
        return bias.minus(d_ts.multipliedBy(slope).dividedBy(10 ** 18)).toNumber();
      }
    }
  } catch (e) {
    console.log(e);
    return e;
  }
};

export const getPrice = (tokenAddress: string, tokenId: string) => {
  if (tokenAddress === "KT1XFABWm5H9CMFL3T5iNb7Zz6YVpLHQjpsA") {
    return 0.1;
  } else if (tokenAddress === "KT1Uw1oio434UoWFuZTNKFgt5wTM9tfuf7m7") {
    if (tokenId === "0") {
      return 1500;
    } else if (tokenId === "1") {
      return 22000;
    } else if (tokenId === "2") {
      return 1;
    } else if (tokenId === "3") {
      return 1;
    } else if (tokenId === "4") {
      return 1.5;
    } else {
      return 0;
    }
  } else {
    return 0;
  }
};

export const getTokenDecimal = (tokenAddress: string, tokenId: string) => {
  if (tokenAddress === "KT1XFABWm5H9CMFL3T5iNb7Zz6YVpLHQjpsA") {
    return 18;
  } else if (tokenAddress === "KT1Uw1oio434UoWFuZTNKFgt5wTM9tfuf7m7") {
    if (tokenId === "0") {
      return 18;
    } else if (tokenId === "1") {
      return 8;
    } else if (tokenId === "2") {
      return 6;
    } else if (tokenId === "3") {
      return 6;
    } else if (tokenId === "4") {
      return 18;
    } else {
      return 18;
    }
  } else {
    return 18;
  }
};

export const getRealEmission = async (tzktProvider: TzktProvider, contracts: Contracts) => {
  const totalSupply = new BigNumber(await tzktProvider.getCurrentTotalSupply(contracts.ply.address));
  const lockedSupply = new BigNumber(await tzktProvider.getLockedSupply(contracts.voteEscrow.address));
  const emission = await tzktProvider.getEmissionData(contracts.voter.address);
  const emission_offset = new BigNumber(emission.base)
    .multipliedBy(lockedSupply)
    .div(totalSupply)
    .div(contracts.EMISSION_FACTOR);
  const emission_real = new BigNumber(emission.base).minus(emission_offset);
  console.log(emission_real.toString());
  return emission_real;
};

export const calculateAPR = async (
  contracts: Contracts,
  tzktProvider: TzktProvider,
  pool: Pool,
  currentEpoch: string,
  emission_real: BigNumber
) => {
  const amm_votes = new BigNumber(
    await tzktProvider.getAmmVotes(contracts.bigMaps.total_amm_votes.toString(), currentEpoch, pool.amm)
  );
  const epoch_votes = new BigNumber(
    await tzktProvider.getEpochVotes(contracts.bigMaps.total_epoch_votes.toString(), currentEpoch)
  );
  const vote_share = amm_votes.div(epoch_votes).times(100);
  const amm_emission = new BigNumber(emission_real).multipliedBy(vote_share).div(100);

  const amm_supply = await tzktProvider.getAmmPoolValues(pool.amm);

  const token1Price = getPrice(pool.token1, pool.token1_id.toString());

  const token2Price = getPrice(pool.token2, pool.token2_id.toString());

  const token1DollarValue = new BigNumber(amm_supply.token1Pool)
    .multipliedBy(token1Price)
    .div(10 ** pool.token1_decimals);
  const token2DollarValue = new BigNumber(amm_supply.token2Pool)
    .multipliedBy(token2Price)
    .div(10 ** pool.token2_decimals);

  const poolDollarValue = token1DollarValue.plus(token2DollarValue);
  console.log("poolDollar", poolDollarValue.toString());
  const plyDollarValue = amm_emission.multipliedBy(getPrice(contracts.ply.address, "0")).div(10 ** 18);
  console.log("plyDollar", plyDollarValue.toString(), amm_supply);

  const apr = new BigNumber(plyDollarValue).div(poolDollarValue).times(100 * 52);
  return apr.toString();
};

const testnetToMainnet = {
  KT1Px1JEGhrUNdojjS6QHrTWXLdWVwWByCiB: "KT1PU4Ce89RyF1itwYxknVNcvtUWKdKy6rvQ",
  KT1XLpc153VJL1mMsmgfZ9Ff2ANSD3qVDtcV: "KT1Qs52cCz1gLK8LYi6cZJm7YjExg6MYLdkG",
};

export const getMainnetAddress = (type: string) => {
  if (type == "VOLATILE") {
    return "KT1Qs52cCz1gLK8LYi6cZJm7YjExg6MYLdkG";
  } else return "KT1PU4Ce89RyF1itwYxknVNcvtUWKdKy6rvQ";
};
