function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 25);
}

function shortSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

export function plan(inspection, answers) {
  const projectId = `${slugify(answers.appName)}-${shortSuffix()}`;

  const hosting = {
    publicDir: inspection.outputDir ?? "dist",
    rewrites: answers.shape === "C"
      ? [{ source: "/api/**", function: "api" }]
      : []
  };

  const auth = answers.needsAuth ? { providers: ["google"] } : null;
  const firestore = answers.needsDb ? { rulesFile: "firestore.rules" } : null;
  const functions = answers.shape === "C"
    ? { dir: "functions", region: "europe-west3", secrets: answers.secretKeys ?? [] }
    : null;

  return {
    appName: answers.appName,
    shape: answers.shape,
    firebase: { projectId },
    hosting,
    auth,
    firestore,
    functions,
    build: {
      command: inspection.framework === "none" ? null : "npm run build",
      outputDir: inspection.outputDir
    }
  };
}
