/**
 * Worker entry point.
 * Run: pnpm agent:worker        (loop forever)
 *      pnpm agent:worker --once (single pass, for cron)
 */
import { workerLoop } from "../agent/worker";

const once = process.argv.includes("--once");
workerLoop({ once }).catch((err) => {
  console.error(err);
  process.exit(1);
});
