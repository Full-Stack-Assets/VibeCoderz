"""
Smoke-test script for the Vercel Sandbox Python SDK.

Usage:
    # Copy env vars into a local file first:
    cp .env.example .env.local
    # Fill in VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, then:
    python scripts/test_sandbox.py

Required env vars (SDK reads them automatically):
    VERCEL_TOKEN        — Personal access token from vercel.com/account/tokens
    VERCEL_PROJECT_ID   — Found in vercel.com/<team>/<project>/settings
    VERCEL_TEAM_ID      — Found in vercel.com/<team>/settings (teamId field)
"""

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv
from vercel.sandbox import AsyncSandbox

# Load .env.local from the project root (one level up from scripts/).
load_dotenv(Path(__file__).parent.parent / ".env.local")


async def main() -> None:
    print("Creating sandbox...")
    sandbox = await AsyncSandbox.create()
    print(f"Sandbox ready: {sandbox.sandbox_id}")

    try:
        # Basic echo test
        cmd = await sandbox.run_command("echo", ["Hello from Vercel Sandbox!"])
        stdout = (await cmd.stdout()).strip()
        print(f"Echo: {stdout!r}")
        assert stdout == "Hello from Vercel Sandbox!", f"Unexpected output: {stdout!r}"

        # Node.js version check — mirrors what the platform tools do
        cmd = await sandbox.run_command("node", ["--version"])
        node_ver = (await cmd.stdout()).strip()
        print(f"Node.js: {node_ver}")

        # Write a file and read it back
        await sandbox.write_file(
            path="/tmp/hello.txt",
            data=b"written from Python SDK\n",
        )
        content = await sandbox.read_file("/tmp/hello.txt")
        print(f"File round-trip: {content.decode().strip()!r}")
        assert b"written from Python SDK" in content

        print("\nAll checks passed.")
    finally:
        await sandbox.stop()
        print("Sandbox stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except RuntimeError as e:
        # Surface credential errors with a helpful hint
        if "Missing credentials" in str(e):
            print(f"\nError: {e}", file=sys.stderr)
            print(
                "\nSet VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_TEAM_ID "
                "in .env.local (see .env.example).",
                file=sys.stderr,
            )
            sys.exit(1)
        raise
