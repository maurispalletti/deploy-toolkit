#!/usr/bin/env bash
# init-scaffold.sh — scaffold a Next.js 14 + Firebase + Shadcn + TanStack app.
# Usage: init-scaffold.sh APP_DIR PROJECT_NAME
set -euo pipefail

APP_DIR="$1"
PROJECT_NAME="$2"

step()         { printf "▸ %s\n" "$1"; }
info()         { printf "  %s\n" "$1"; }
toolkit_error(){ printf "DEPLOY_TOOLKIT_ERROR:%s:%s\n" "$1" "$2"; }

cd "$APP_DIR"

# ── 0. Fetch Firebase SDK config and write .env.local ─────────────────────────
step "Fetching Firebase SDK config"
# Get the web app ID for this project
firebase apps:list WEB --project "$PROJECT_NAME" --json \
  >/tmp/dt_apps_list.json 2>&1 || echo '{}' >/tmp/dt_apps_list.json

APP_ID=$(node -e "
let d=''; process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try { process.stdout.write((JSON.parse(d).result||[])[0]?.appId||''); }
  catch { process.stdout.write(''); }
});
" </tmp/dt_apps_list.json 2>/dev/null || true)

info "Web app ID: ${APP_ID:-'(not found)'}"

if [ -n "$APP_ID" ]; then
  # Capture both: plain JS snippet (reliable) and JSON (fallback)
  firebase apps:sdkconfig "$APP_ID" --project "$PROJECT_NAME" \
    >/tmp/dt_sdk.txt 2>&1 || true

  info "Raw sdkconfig output:"
  cat /tmp/dt_sdk.txt

  cat > /tmp/dt_write_env.js << 'JSEOF'
const fs = require('fs');
const appDir = process.argv[2];

function extract(txt, key) {
  // Handle both double and single quoted values: key: "val" or key: 'val'
  const m = txt.match(new RegExp(key + '\\s*[=:]\\s*["\']([^"\']+)["\']'));
  return m ? m[1] : '';
}

const txt = fs.readFileSync('/tmp/dt_sdk.txt', 'utf8');
const c = {
  apiKey:            extract(txt, 'apiKey'),
  authDomain:        extract(txt, 'authDomain'),
  projectId:         extract(txt, 'projectId'),
  storageBucket:     extract(txt, 'storageBucket'),
  messagingSenderId: extract(txt, 'messagingSenderId'),
  appId:             extract(txt, 'appId'),
};

console.log('  apiKey found:', !!c.apiKey);

fs.writeFileSync(appDir + '/.env.local', [
  'NEXT_PUBLIC_FIREBASE_API_KEY='              + (c.apiKey             || ''),
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN='         + (c.authDomain         || ''),
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID='          + (c.projectId          || ''),
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET='      + (c.storageBucket      || ''),
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=' + (c.messagingSenderId  || ''),
  'NEXT_PUBLIC_FIREBASE_APP_ID='              + (c.appId              || ''),
].join('\n') + '\n');
console.log('  Wrote .env.local');
JSEOF

  node /tmp/dt_write_env.js "$APP_DIR"
else
  info "Warning: no web app found for project '$PROJECT_NAME' — .env.local will have empty values"
fi

# ── 1. Scaffold Next.js 14 into a temp dir, then copy over ───────────────────
step "Scaffolding Next.js 14 (this takes a minute…)"
TEMP_DIR="$(dirname "$APP_DIR")/scaffold-tmp-$$"
npx --yes create-next-app@14 "$TEMP_DIR" \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-git \
  --yes 2>&1

# Merge scaffold into app dir, preserving our .git.
# Wipe node_modules first so a retry doesn't leave a corrupt mixed state.
rm -rf "$APP_DIR/node_modules"
rsync -a --exclude='.git' --exclude='.env.local' "$TEMP_DIR/" "$APP_DIR/"
rm -rf "$TEMP_DIR"

# Fix package name (create-next-app uses the dir name)
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = process.argv[2];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
" "$PROJECT_NAME"

# ── 2. Install dependencies ───────────────────────────────────────────────────
step "Installing Firebase, TanStack Query, Shadcn, and icon dependencies"
npm install --loglevel=error \
  firebase \
  @tanstack/react-query \
  lucide-react \
  class-variance-authority \
  clsx \
  tailwind-merge \
  tailwindcss-animate \
  @radix-ui/react-slot 2>&1

# ── 3. Configure Next.js for static export ───────────────────────────────────
step "Configuring Next.js for static export"
# Write to next.config.mjs — Next.js 14 does not support next.config.ts
# (TypeScript config support was added in Next.js 15). Remove the .ts stub
# that create-next-app may have generated so there is no ambiguity.
rm -f next.config.ts
cat > next.config.mjs << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
EOF

# ── 4. Shadcn UI — config + utility files ────────────────────────────────────
step "Setting up Shadcn UI"

cat > components.json << 'EOF'
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
EOF

mkdir -p lib components/ui

cat > lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF

cat > tailwind.config.ts << 'EOF'
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
EOF

cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
EOF

# ── 5. Shadcn Button component ────────────────────────────────────────────────
cat > components/ui/button.tsx << 'EOF'
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
EOF

# ── 6. Hello World app — Google SSO + Firestore ───────────────────────────────
step "Writing Hello World app with Google sign-in and Firestore"

# app/page.tsx — thin server shell, delegates to client component
cat > app/page.tsx << 'EOF'
import { HelloWorld } from "@/components/hello-world";

export default function Home() {
  return <HelloWorld />;
}
EOF

# components/hello-world.tsx
# Single-quoted heredoc: no bash expansion, so TypeScript template literals are safe.
cat > components/hello-world.tsx << 'EOF'
"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type AuthError,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

export function HelloWorld() {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try {
          const ref  = doc(db, "greetings", u.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setGreeting(snap.data().message as string);
          } else {
            const message = `Hello, ${u.displayName ?? u.email}!`;
            await setDoc(ref, { message, uid: u.uid });
            setGreeting(message);
          }
        } catch {
          setGreeting(`Hello, ${u.displayName ?? u.email}!`);
        }
      } else {
        setGreeting("");
      }
    });
  }, []);

  async function handleSignIn() {
    setAuthError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      const e = err as AuthError;
      if (e.code === "auth/operation-not-allowed") {
        setAuthError(
          "Google sign-in is not enabled yet. In Firebase Console go to " +
          "Authentication → Sign-in method → Google → Enable."
        );
      } else {
        setAuthError(e.message);
      }
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-6 max-w-sm mx-auto p-8">
          <h1 className="text-5xl font-bold tracking-tight">Hello World</h1>
          <p className="text-muted-foreground">Sign in with your Google account to continue.</p>
          <Button onClick={handleSignIn} size="lg">
            Sign in with Google
          </Button>
          {authError && (
            <p className="text-sm text-destructive">{authError}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6 max-w-sm mx-auto p-8">
        {user.photoURL && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={user.displayName ?? ""}
            width={80}
            height={80}
            className="rounded-full mx-auto ring-2 ring-border"
          />
        )}
        <h1 className="text-5xl font-bold tracking-tight">
          {greeting || `Hello, ${user.displayName ?? user.email}!`}
        </h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>
        <Button variant="outline" onClick={() => signOut(auth)}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
EOF

# ── 7. Firebase SDK + TanStack setup ─────────────────────────────────────────
cat > lib/firebase.ts << 'EOF'
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
EOF

cat > lib/query-client.ts << 'EOF'
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000 },
  },
});
EOF

cat > app/providers.tsx << 'EOF'
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
EOF

# app/layout.tsx — unquoted heredoc so $PROJECT_NAME expands;
# JSX tokens like {inter.className} have no leading $ so they're safe.
cat > app/layout.tsx << EOF
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "$PROJECT_NAME",
  description: "Built with Next.js and Firebase",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
EOF

# ── 8. Firestore database + rules ─────────────────────────────────────────────
step "Setting up Firestore"

# Firestore security rules — greetings are private per user
cat > firestore.rules << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /greetings/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
EOF

cat > firestore.indexes.json << 'EOF'
{
  "indexes": [],
  "fieldOverrides": []
}
EOF

# Try to create the Firestore database (fails silently if already exists)
set +e
firebase firestore:databases:create \
  --project "$PROJECT_NAME" \
  --location "us-central1" 2>&1 || true
set -e

# ── 10. Firebase Hosting + Firestore config ────────────────────────────────────
step "Writing firebase.json and .firebaserc"
cat > firebase.json << 'EOF'
{
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
EOF

node -e "
const fs = require('fs');
fs.writeFileSync(
  '.firebaserc',
  JSON.stringify({ projects: { default: process.argv[2] } }, null, 2) + '\n'
);
" "$PROJECT_NAME"

# ── 11. package.json scripts ──────────────────────────────────────────────────
step "Updating package.json scripts"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = {
  ...pkg.scripts,
  build: 'next build',
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# ── 12. Commit ─────────────────────────────────────────────────────────────────
step "Committing scaffold"
git add -A
git commit -m "scaffold: Next.js 14 + Firebase auth + Firestore + Shadcn UI + TanStack Query"

info ""
info "One manual step required:"
info "  Firebase Console > Authentication > Sign-in method > Google > Enable"
info ""
info "Then run: cd $APP_DIR && npm run dev"
info ""

printf "DEPLOY_TOOLKIT_SCAFFOLD_DONE:%s\n" "$APP_DIR"
