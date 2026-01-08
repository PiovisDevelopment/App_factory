#!/usr/bin/env python3
"""
PPF Build Executor (Windows Native)
Strict Mode: Python 3.11 + venv required.
"""

import glob
import json
import logging
import os
import subprocess
import sys

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger("Builder")

def get_project_root():
    """Finds the project root containing src-tauri."""
    current = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(current))

    if os.path.exists(os.path.join(root, "src-tauri")):
        return root

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

        identifier = conf.get('tauri', {}).get('bundle', {}).get('identifier', '')

        if identifier == "com.tauri.dev":
            return {
                "valid": False,
                "error": "Bundle Identifier is still 'com.tauri.dev'. Please change it in src-tauri/tauri.conf.json before building."
            }

        return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": f"Failed to read tauri.conf.json: {e}"}

def find_artifacts(root_path):
    """Locates the generated installers."""
    release_dir = os.path.join(root_path, "src-tauri", "target", "release", "bundle")

    artifacts = {
        "msi": [],
        "nsis": []
    }

    msi_path = os.path.join(release_dir, "msi", "*.msi")
    artifacts["msi"] = glob.glob(msi_path)

    nsis_path = os.path.join(release_dir, "nsis", "*.exe")
    artifacts["nsis"] = glob.glob(nsis_path)

    return artifacts

def build_application():
    """Runs the build process."""

    # --- STRICT CHECK START ---
    # 1. Check Python Version (Strict 3.11)
    major, minor = sys.version_info[:2]
    if major != 3 or minor != 11:
        return {
            "success": False,
            "error": f"STRICT REQUIREMENT: Python 3.11 is required to build. You are running {major}.{minor}."
        }

    # 2. Check Virtual Environment
    is_venv = (sys.prefix != sys.base_prefix) or hasattr(sys, 'real_prefix')
    if not is_venv:
        return {
            "success": False,
            "error": "STRICT REQUIREMENT: You must be inside a 'venv' virtual environment to build."
        }
    # --- STRICT CHECK END ---

    root_path = get_project_root()
    if not root_path:
        return {"success": False, "error": "Could not find project root (src-tauri not found)."}

    # 1. Check Identifier
    check = check_bundle_identifier(root_path)
    if not check['valid']:
        return {"success": False, "error": check['error']}

    logger.info("Starting build process... (This may take 5-10 minutes)")

    # 2. Run Build Command
    cmd = ["npm.cmd", "run", "tauri", "build"]

    try:
        process = subprocess.Popen(
            cmd,
            cwd=root_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=True
        )

        for line in process.stdout:
            print(line, end='')

        process.wait()

        if process.returncode != 0:
            return {"success": False, "error": "Build command failed. Check logs above."}

    except Exception as e:
        return {"success": False, "error": f"Failed to execute build command: {e}"}

    # 3. Locate Artifacts
    artifacts = find_artifacts(root_path)

    found_paths = []
    found_paths.extend(artifacts['msi'])
    found_paths.extend(artifacts['nsis'])

    if not found_paths:
        return {"success": False, "error": "Build finished but no artifacts found."}

    return {
        "success": True,
        "installer_path": found_paths[0],
        "all_artifacts": found_paths
    }

if __name__ == "__main__":
    result = build_application()
    if result['success']:
        print("\n✅ BUILD SUCCESSFUL")
        print(f"Installer: {result['installer_path']}")
    else:
        print(f"\n❌ BUILD FAILED: {result['error']}")
        sys.exit(1)
