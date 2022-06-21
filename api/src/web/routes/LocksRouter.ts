import { Request, Response, Router } from "express";
import { Dependecies, Lock } from "../../types";
import { TezosToolkit } from "@taquito/taquito";

function build({ dbClient, config, contracts }: Dependecies): Router {
  const router = Router();
  const tezos = new TezosToolkit(config.rpc);
  router.get("/", async (req: Request, res: Response) => {
    const address = req.query.address as string;
    const token_id = req.query.token_id as string;
    if (!address && !token_id) {
      return res.status(400).json({ message: "MISSING_ADDRESS_OR_ID" });
    }
    let locks;
    if (address && !token_id) {
      locks = await dbClient.getAll({
        select: "*",
        table: "locks",
        where: `owner='${address}'`,
      });
    } else if (!address && token_id) {
      locks = await dbClient.get({
        select: "*",
        table: "locks",
        where: `id=${token_id}`,
      });
    } else {
      locks = await dbClient.get({
        select: "*",
        table: "locks",
        where: `owner='${address}' AND id=${token_id}`,
      });
    }
    let finalLocks: Lock[] = [];
    if (locks.rowCount !== 0) {
      console.log("locks", locks.rows);
      const finalLocksPromise = locks.rows.map(async (lock) => {
        const contract = await tezos.contract.at(contracts.voteEscrow.address);
        const date = Math.round(new Date().getTime() / 1000);
        const result = await contract.contractViews
          .get_token_voting_power({ token_id: lock.id, ts: date, time: 0 })
          .executeView({ viewCaller: "KT1H7Bg7r7Aa9sci2hoJtmTdS7W64aq4vev8" });
        return {
          ...lock,
          voting_power: result.toString(),
        };
      });
      finalLocks = await Promise.all(finalLocksPromise);
      console.log("finalLocks", finalLocks);
    }

    return res.json({ result: finalLocks });
  });
  return router;
}

export default build;
