import { Request, Response, Router } from "express";
import { Dependecies, TokenType } from "../../types";
import { calculateAPR, getMainnetAddress, getRealEmission, getToken } from "../../infrastructure/utils";

function build({ dbClient, contracts, tzktProvider, getData, getAPR }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const address = req.query.address as string;
      if (address) {
        const APRs = await getAPR();
        let positions = [];
        const positions1 = await dbClient.getAll({
          select: "*",
          table: "positions",
          where: `user_address='${address}'`,
        });
        if (positions1.rowCount !== 0) {
          const finalPositionsPromise = positions1.rows.map(async (position) => {
            const boostTokenId = await tzktProvider.getAttachToken({
              address: address,
              bigMap: position.attach_bigmap,
            });
            return {
              amm: position.amm,
              lqtBalance: position.balance,
              stakedBalance: position.staked_balance,
              derivedBalance: position.derived_balance,
              boostTokenId: boostTokenId,
              poolAPR: APRs[position.amm] || 0,
            };
          });

          positions = await Promise.all(finalPositionsPromise);

          return res.json(positions);
        } else {
          return res.json([]);
        }
      } else {
        return res.status(400).json({ message: "User address not provided" });
      }
    } catch (e) {
      console.log(e);
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
