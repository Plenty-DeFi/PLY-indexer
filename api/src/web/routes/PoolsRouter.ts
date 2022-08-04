import { Request, Response, Router } from "express";
import { Dependecies } from "../../types";
import BigNumber from "bignumber.js";
import { getPrice, getTokenDecimal } from "../../infrastructure/utils";

function build({ dbClient, config, contracts, tzktProvider }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const amm = req.query.amm as string;
      if (amm) {
        const pool = await dbClient.get({
          select: "*",
          table: "pools",
          where: `amm='${amm}'`,
        });
        if (pool.rowCount !== 0) {
          const totalSupply = new BigNumber(await tzktProvider.getCurrentTotalSupply(contracts.ply.address));
          const lockedSupply = new BigNumber(await tzktProvider.getLockedSupply(contracts.voteEscrow.address));
          const emission = await tzktProvider.getEmissionData(contracts.voter.address);
          const emission_offset = new BigNumber(emission.base)
            .multipliedBy(lockedSupply)
            .div(totalSupply)
            .div(contracts.EMISSION_FACTOR);
          const emission_real = new BigNumber(emission.base).minus(emission_offset);
          console.log(emission_real.toString());

          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const bribes = await tzktProvider.getBribes(pool.rows[0].bribe_bigmap, currentEpoch);

          const amm_votes = new BigNumber(
            await tzktProvider.getAmmVotes(contracts.bigMaps.total_amm_votes.toString(), currentEpoch, amm)
          );
          const epoch_votes = new BigNumber(
            await tzktProvider.getEpochVotes(contracts.bigMaps.total_epoch_votes.toString(), currentEpoch)
          );
          const vote_share = amm_votes.div(epoch_votes).times(100);
          const amm_emission = new BigNumber(emission_real).multipliedBy(vote_share).div(100);

          const amm_supply = await tzktProvider.getAmmPoolValues(pool.rows[0].amm);

          const token1Decimals = getTokenDecimal(
            pool.rows[0].token1,
            pool.rows[0].token1_check,
            pool.rows[0].token1_id
          );
          const token1Price = getPrice(pool.rows[0].token1, pool.rows[0].token1_check, pool.rows[0].token1_id);
          const token2Decimals = getTokenDecimal(
            pool.rows[0].token2,
            pool.rows[0].token2_check,
            pool.rows[0].token2_id
          );
          const token2Price = getPrice(pool.rows[0].token2, pool.rows[0].token2_check, pool.rows[0].token2_id);

          const token1DollarValue = new BigNumber(amm_supply.token1Pool)
            .multipliedBy(token1Price)
            .div(10 ** token1Decimals);
          const token2DollarValue = new BigNumber(amm_supply.token2Pool)
            .multipliedBy(token2Price)
            .div(10 ** token2Decimals);
          const poolDollarValue = token1DollarValue.plus(token2DollarValue);
          console.log("poolDollar", poolDollarValue.toString());
          const plyDollarValue = amm_emission
            .multipliedBy(getPrice(contracts.ply.address, false, "0"))
            .div(10 ** getTokenDecimal(contracts.ply.address, false, "0"));
          console.log("plyDollar", plyDollarValue.toString(), amm_supply);
          const apr = new BigNumber(plyDollarValue).div(poolDollarValue).times(100 * 52);
          return res.json({ ...pool.rows[0], bribes, apr: apr.toString() });
        } else {
          return res.status(400).json({ message: "AMM_NOT_EXIST" });
        }
      } else {
        let pools = [];
        const pool = await dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        });
        if (pool.rowCount !== 0) {
          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const finalPoolsPromise = pool.rows.map(async (pool) => {
            const bribes = await tzktProvider.getBribes(pool.bribe_bigmap, currentEpoch);
            return {
              ...pool,
              bribes,
            };
          });
          pools = await Promise.all(finalPoolsPromise);

          return res.json(pools);
        } else {
          return res.json([]);
        }
      }
    } catch (e) {
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
