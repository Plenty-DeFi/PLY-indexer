import BigNumber from "bignumber.js";
import TzktProvider from "./TzktProvider";
import { config } from "../config";
import { AlltokenCheckpoints, Contracts, Pool, Token, TokenType } from "../types";

const TzktObj = new TzktProvider(config);

export const votingPower = async (tokenId: number, ts2: number, time: number) => {
  try {
    let factor: number = 7 * 480; // todo change later to 7 * 86400
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
      throw "0";
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
        return "0";
      } else {
        return f_bias.decimalPlaces(0, 1).toString();
      }
    } else {
      let high = Number(sec) - 2;
      let low = 0;
      let mid = 0;

      while (low < high && map1.get((mid + 1).toString()).ts != ts) {
        mid = Math.floor((low + high + 1) / 2);
        if (map1.get((mid + 1).toString()).ts < ts) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      if (map1.get(`${mid + 1}`).ts === ts) {
        return map1.get((mid + 1).toString()).bias.toString();
      } else {
        const ob = map1.get(`${low + 1}`);
        const bias = new BigNumber(ob.bias);
        const slope = new BigNumber(ob.slope);
        const d_ts = ts.minus(ob.ts);
        return bias
          .minus(d_ts.multipliedBy(slope).dividedBy(10 ** 18))
          .decimalPlaces(0, 1)
          .toString();
      }
    }
  } catch (e) {
    console.log(e);
    return e;
  }
};

export const votingPowerFast = (ts2: number, time: number, map1: Map<any, any>, sec: string) => {
  try {
    let factor: number = 7 * 480; // todo change later to 7 * 86400
    if (time === 0) {
      factor = 1;
    }
    // Must round down to nearest whole week
    ts2 = Math.floor(ts2 / factor) * factor;
    const ts = new BigNumber(ts2);

    if (ts < map1.get("1").ts) {
      throw "0";
    }

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
        return "0";
      } else {
        return f_bias.decimalPlaces(0, 1).toString();
      }
    } else {
      let high = Number(sec) - 2;
      let low = 0;
      let mid = 0;

      while (low < high && map1.get((mid + 1).toString()).ts != ts) {
        mid = Math.floor((low + high + 1) / 2);
        if (map1.get((mid + 1).toString()).ts < ts) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      if (map1.get(`${mid + 1}`).ts === ts) {
        return map1.get((mid + 1).toString()).bias.toString();
      } else {
        const ob = map1.get(`${low + 1}`);
        const bias = new BigNumber(ob.bias);
        const slope = new BigNumber(ob.slope);
        const d_ts = ts.minus(ob.ts);
        return bias
          .minus(d_ts.multipliedBy(slope).dividedBy(10 ** 18))
          .decimalPlaces(0, 1)
          .toString();
      }
    }
  } catch (e) {
    console.log(e);
    return e;
  }
};

/* export const totalVotingPower = async (ts2: number, time: number) => {
  try {
    let factor: number = 7 * 480;
    if (time === 0) {
      factor = 1;
    }
    // Must round down to nearest whole week
    ts2 = Math.floor(ts2 / factor) * factor;
    const ts = new BigNumber(ts2);

    const global_checkpoints = await TzktObj.getGlobalCheckpoints();
    const gc_index =
    const map1 = new Map();
    for (var x in global_checkpoints) {
      map1.set(global_checkpoints[x].key, global_checkpoints[x].value);
    }

    if (ts < map1.get("1").ts) {
      throw "0";
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
        return "0";
      } else {
        return f_bias.decimalPlaces(0, 1).toString();
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
        return map1.get(mid + 1).bias.toString();
      } else {
        const ob = map1.get(`${low + 1}`);
        const bias = new BigNumber(ob.bias);
        const slope = new BigNumber(ob.slope);
        const d_ts = ts.minus(ob.ts);
        return bias
          .minus(d_ts.multipliedBy(slope).dividedBy(10 ** 18))
          .decimalPlaces(0, 1)
          .toString();
      }
    }
  } catch (e) {
    console.log(e);
    return e;
  }
}; */

export const getPrice = (tokenAddress: string, tokenId: string) => {
  //todo change it to analytics price
  if (tokenAddress === "KT1ArfQ6At3NhzMbiGwLzGtvekytjXq6Gy2G") {
    return 0.1;
  } else if (tokenAddress == "KT1Q4qRd8mKS7eWUgTfJzCN8RC6h9CzzjVJb") {
    return 1.8;
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
    return 1.8;
  }
};

export const getTokenDecimal = (tokenAddress: string, tokenId: string) => {
  if (tokenAddress === "KT1ArfQ6At3NhzMbiGwLzGtvekytjXq6Gy2G") {
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
    return 6;
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
  currentEpoch: string
) => {
  let epoch = `${Number(currentEpoch) - 1}`;
  const amm_votes = new BigNumber(
    await tzktProvider.getAmmVotes(contracts.bigMaps.total_amm_votes.toString(), epoch, pool.amm)
  );
  const epoch_votes = new BigNumber(
    await tzktProvider.getEpochVotes(contracts.bigMaps.total_epoch_votes.toString(), epoch)
  );
  const vote_share = amm_votes.div(epoch_votes).times(100);

  const emission = await tzktProvider.getEmissionData(contracts.voter.address);

  const amm_emission = new BigNumber(emission.real).multipliedBy(vote_share).div(100);

  const amm_supply = await tzktProvider.getAmmPoolValues(pool.amm);

  const token1Price = getPrice(pool.token1, pool.token1_id?.toString());

  const token2Price = getPrice(pool.token2, pool.token2_id?.toString());

  const token1DollarValue = new BigNumber(amm_supply.token1Pool)
    .multipliedBy(token1Price)
    .div(10 ** pool.token1_decimals);
  const token2DollarValue = new BigNumber(amm_supply.token2Pool)
    .multipliedBy(token2Price)
    .div(10 ** pool.token2_decimals);

  const poolDollarValue = token1DollarValue.plus(token2DollarValue);
  //console.log("poolDollar", poolDollarValue.toString());
  const plyDollarValue = amm_emission.multipliedBy(getPrice(contracts.ply.address, "0")).div(10 ** 18);
  //console.log("plyDollar", plyDollarValue.toString(), amm_supply);

  const apr = new BigNumber(plyDollarValue).div(poolDollarValue).times(100 * 52);
  return isNaN(apr.toNumber()) ? "0" : apr.toString();
};

export const calculateFutureAPR = async (
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

  const token1Price = getPrice(pool.token1, pool.token1_id?.toString());

  const token2Price = getPrice(pool.token2, pool.token2_id?.toString());

  const token1DollarValue = new BigNumber(amm_supply.token1Pool)
    .multipliedBy(token1Price)
    .div(10 ** pool.token1_decimals);
  const token2DollarValue = new BigNumber(amm_supply.token2Pool)
    .multipliedBy(token2Price)
    .div(10 ** pool.token2_decimals);

  const poolDollarValue = token1DollarValue.plus(token2DollarValue);
  //console.log("poolDollar", poolDollarValue.toString());
  const plyDollarValue = amm_emission.multipliedBy(getPrice(contracts.ply.address, "0")).div(10 ** 18);
  //console.log("plyDollar", plyDollarValue.toString(), amm_supply);

  const apr = new BigNumber(plyDollarValue).div(poolDollarValue).times(100 * 52);
  return isNaN(apr.toNumber()) ? "0" : apr.toString();
};

export const getToken = (type: TokenType, tokens: Token[]): string => {
  if (type.hasOwnProperty("fa2")) {
    return tokens.find((x) => x.address == type.fa2.address && x.tokenId.toString() == type.fa2.nat.toString()).symbol;
  } else if (type.hasOwnProperty("fa12")) {
    return tokens.find((x) => x.address == type.fa12).symbol;
  } else {
    return "tez";
  }
};

export const range = (start: number, stop: number, step = 1) =>
  Array(Math.ceil((stop - start) / step))
    .fill(start)
    .map((x, y) => (x + y * step).toString());
