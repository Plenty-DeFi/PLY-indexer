import { Request, Response, Router } from "express";
import { Dependecies } from "../../types";

function build({ dbClient }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const address = req.query.address as string;
      const pool = req.query.pool as string;
      if (address) {
        const positions = await dbClient.getAll({
          select: "*",
          table: "v3_positions",
          where: `owner='${address}' AND amm='${pool}'`,
        });
        if (positions.rowCount !== 0) {
          return res.json(positions.rows);
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
