import { Request, Response, Router } from "express";
import { Dependecies, TokenType } from "../../types";
function build({ dbClient }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const provider = req.query.address as string;
      if (provider) {
        const bribes = await dbClient.getAll({
          select: "value, name, amm, epoch",
          table: "bribes",
          where: `provider='${provider}'`,
        });
        //console.log(bribes.rows);
        return res.json(bribes.rows);
      } else {
        return res.status(400).json({ message: "address not provided" });
      }
    } catch (e) {
      console.log(e);
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
