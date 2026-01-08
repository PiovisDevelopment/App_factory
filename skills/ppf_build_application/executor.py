#!/usr/bin/env python3
"""
PPF Build Executor (Windows Native)
"""

import glob
import json
import logging
import os
import subprocess
import sys

from env_detection import detect_windows_native_environment
from env_preflight import run_preflight_env_check
from path_risk import check_path_length_risk
from runtime_bundler import build_runtime_bundle

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("Builder")


def get_project_root():
    """Finds the project root containing src-tauri."""
    # Assuming script is in skills/ppf_build_application/
    # Go up two levels
    current = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(current))

    if os.path.exists(os.path.join(root, "src-tauri")):
        return root

    # Fallback: Check current working directory
    cwd = os.getcwd()
    if os.path.exists(os.path.join(cwd, "src-tauri")):
        return cwd

    return None


def check_bundle_identifier(root_path):
    """Ensures the bundle identifier is not the default."""
    conf_path = os.path.join(root_path, "src-tauri", "tauri.conf.json")

    try:
        with open(conf_path) as f:
            conf = json.load(f)

        identifier = conf.get("tauri", {}).get("bundle", {}).get("identifier", "")

        if identifier == "com.tauri.dev":
            return {
                "valid": False,
                "error": "Bundle Identifier is still 'com.tauri.dev'. Please change it in src-tauri/tauri.conf.json before building.",
            }

        return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": f"Failed to read tauri.conf.json: {e}"}


def find_artifacts(root_path):
    """Locates the generated installers."""
    release_dir = os.path.join(root_path, "src-tauri", "target", "release", "bundle")

    artifacts = {
        "msi": [],
        "nsis": [],  # .exe setup files
    }

    # Check MSI
    msi_path = os.path.join(release_dir, "msi", "*.msi")
    artifacts["msi"] = glob.glob(msi_path)

    # Check NSIS (Exe)
    nsis_path = os.path.join(release_dir, "nsis", "*.exe")
    artifacts["nsis"] = glob.glob(nsis_path)

    return artifacts


def build_application():
    """Runs the build process."""
    root_path = get_project_root()
    if not root_path:
        return {"success": False, "error": "Could not find project root (src-tauri not found)."}

    # Environment must be native Windows for build operations.
    env_info = detect_windows_native_environment()
    if not env_info.is_supported:
        return {"success": False, "error": env_info.message}

    # Environment pre-flight diagnostics (hard gate for builds)
    env_result = run_preflight_env_check()
    if not env_result.get("ok", False):
        return {
            "success": False,
            "error": env_result.get("summary", "Environment diagnostics failed."),
        }

    # Path length risk detection (advisory only)
    risk = check_path_length_risk(root_path)
    if risk.has_risk and risk.message:
        logger.warning(risk.message)

    # 1. Check Identifier
    check = check_bundle_identifier(root_path)
    if not check["valid"]:
        return {"success": False, "error": check["error"]}

    # 2. Build runtime bundle (Python + plugins) before invoking Tauri build.
    logger.info("Building runtime bundle (Python + plugins)...")
    bundle_result = build_runtime_bundle(root_path)
    if not bundle_result.success:
        return {
            "success": False,
            "error": ("Runtime bundling failed. Portable build cannot proceed.\n" + (bundle_result.message or "")),
        }

    logger.info("Runtime bundle created at %s", bundle_result.runtime_path)
    logger.info("Starting Tauri build process... (This may take 5-10 minutes)")

    # 3. Run Build Command
    # npm run tauri build
    cmd = ["npm.cmd", "run", "tauri", "build"]

    try:
        # Stream output to console so user sees progress
        process = subprocess.Popen(
            cmd,
            cwd=root_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        for line in process.stdout or []:
            print(line, end="")

        process.wait()

        if process.returncode != 0:
            return {"success": False, "error": "Build command failed. Check logs above."}

    except Exception as e:
        return {"success": False, "error": f"Failed to execute build command: {e}"}

    # 3. Locate Artifacts
    artifacts = find_artifacts(root_path)

    found_paths = []
    found_paths.extend(artifacts["msi"])
    found_paths.extend(artifacts["nsis"])

    if not found_paths:
        return {"success": False, "error": "Build finished but no artifacts found."}

    return {
        "success": True,
        "installer_path": found_paths[0],  # Return the first one found
        "all_artifacts": found_paths,
    }


if __name__ == "__main__":
    result = build_application()
    if result["success"]:
        print("\n✅ BUILD SUCCESSFUL")
        print(f"Installer: {result['installer_path']}")
    else:
        print(f"\n❌ BUILD FAILED: {result['error']}")
        sys.exit(1)
