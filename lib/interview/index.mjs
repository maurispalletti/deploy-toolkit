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

  let acceptedBlaze = false;
  if (shape === "C") {
    io?.output?.write?.(
      "\nThis app has backend code. Cloud Functions require Firebase's pay-as-you-go (Blaze) plan.\n" +
      "There's still a free monthly quota — you only pay if usage exceeds it.\n" +
      "You'll need a credit card on file. Upgrade page: https://console.firebase.google.com/project/_/usage/details\n\n"
    );
    acceptedBlaze = await askYesNo("Continue and upgrade later when prompted?", true, io);
  }

  return { appName, needsAuth, needsDb, shape, acceptedBlaze, secretKeys: inspection.envKeys };
}
