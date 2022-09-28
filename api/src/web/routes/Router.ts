import { Router } from "express";
import LocksRouter from "./LocksRouter";
import LockVotingPowerRouter from "./LockVotingPower";
import PoolsRouter from "./PoolsRouter";
import BribesRouter from "./BribesRouter";
import PositionsRouter from "./PositionsRouter";
import VotesRouter from "./VotesRouter";
import InflationRouter from "./InflationRouter";
import { Dependecies } from "../../types";

function build(dependencies: Dependecies): Router {
  const router = Router();
  router.use("/locks", LocksRouter(dependencies));
  router.use("/voting-power", LockVotingPowerRouter(dependencies));
  router.use("/pools", PoolsRouter(dependencies));
  router.use("/bribes", BribesRouter(dependencies));
  router.use("/positions", PositionsRouter(dependencies));
  router.use("/votes", VotesRouter(dependencies));
  router.use("/inflation", InflationRouter(dependencies));
  return router;
}

export default build;
