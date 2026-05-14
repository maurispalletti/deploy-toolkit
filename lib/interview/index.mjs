// lib/interview/index.mjs
import { askText, askYesNo } from "./prompts.mjs";

export async function interview(inspection, io) {
  const appName = await askText(
    "What name for this app? (used as Firebase project ID)",
    inspection.pkgName ?? "my-app",
    io
  );
  const needsAuth = await askYesNo("Will users need to log in?", false, io);
  const needsDb = await askYesNo(
    "Does the app need to remember things between visits?",
    false,
    io
  );

  let shape;
  if (inspection.suggestedShape === "C") {
    shape = "C";
  } else if (needsAuth || needsDb) {
    shape = "B";
  } else {
    shape = "A";
  }

  // Shape C apps need the Blaze plan; the wizard surfaces this on the
  // Plan Summary page (a yellow banner). We don't ask for an explicit
  // up-front "I accept Blaze" answer here because we'd never use it —
  // `firebase deploy` itself prompts the user mid-deploy if the project
  // isn't already on Blaze.

  return { appName, needsAuth, needsDb, shape, secretKeys: inspection.envKeys };
}
