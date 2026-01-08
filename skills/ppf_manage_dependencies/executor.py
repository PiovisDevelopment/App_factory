#!/usr/bin/env python3
"""
PPF Dependency Manager Executor (Windows Native)
Strict Mode: Python 3.11 + venv required.
"""

import json
import logging
import os
import subprocess
import sys

from env_detection import detect_windows_native_environment
from env_preflight import run_preflight_env_check

# Add current directory to sys.path to ensure config can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    import yaml
except ImportError:
    print("CRITICAL: PyYAML is missing. Please run 'pip install pyyaml' first.")
    sys.exit(1)

from config import DEPENDENCY_CONFIG
from manifest_schema import validate_manifest

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("DepManager")


def _validate_dependency_commands():
    """
    Validate pip/npm command configuration and environment overrides.
    Reject unsafe overrides like .ps1 scripts.
    """
    errors = []

    def _check_cmd_list(label: str, cmd_list):
        if not cmd_list:
            errors.append(f"{label} command is empty or not configured.")
            return
        exe = cmd_list[0]
        lower = exe.lower()
        if lower.endswith(".ps1"):
            errors.append(
                f"{label} points to a PowerShell script (.ps1), which is not supported "
                "for dependency operations due to Windows execution policy constraints. "
                "Please set it to 'python -m pip', a pip.exe path, or npm.cmd."
            )
        # Reject obvious Unix-style absolute paths for core commands.
        if exe.startswith("/") or exe.startswith("/usr/") or exe.startswith("/bin/"):
            errors.append(
                f"{label} appears to reference a Unix-style path ({exe}), which is "
                "unsupported. Use Windows-native executables such as pip.exe or npm.cmd "
                "instead."
            )

    _check_cmd_list("PPF_PIP_CMD/pip_install_cmd", DEPENDENCY_CONFIG.get("pip_install_cmd"))
    _check_cmd_list("PPF_NPM_CMD/npm_install_cmd", DEPENDENCY_CONFIG.get("npm_install_cmd"))

    if errors:
        # Join into a single policy error string.
        raise RuntimeError("; ".join(errors))


def validate_environment():
    """
    Enforces Strict Environment Rules:
    1. Python 3.11.x
    2. Active Virtual Environment (venv)
    """
    # 1. Check Python Version (Strict 3.11)
    major, minor = sys.version_info[:2]
    if major != 3 or minor != 11:
        return {
            "valid": False,
            "error": f"STRICT REQUIREMENT: Python 3.11 is required. You are running {major}.{minor}.",
        }

    # 2. Check Virtual Environment
    # In a venv, sys.prefix (env path) is different from sys.base_prefix (global python path)
    is_venv = (sys.prefix != sys.base_prefix) or hasattr(sys, "real_prefix")
    if not is_venv:
        return {
            "valid": False,
            "error": "STRICT REQUIREMENT: You must be inside a 'venv' virtual environment. Please run 'python -m venv venv' and activate it.",
        }

    return {"valid": True}


def load_manifest(plugin_path):
    """Reads the component.yaml file."""
    manifest_path = os.path.join(plugin_path, "component.yaml")
    if not os.path.exists(manifest_path):
        logger.error(f"Manifest not found at: {manifest_path}")
        return None

    try:
        with open(manifest_path) as f:
            raw = yaml.safe_load(f)
        result = validate_manifest(raw, source=manifest_path)
        return result.manifest
    except Exception as e:
        logger.error(f"Failed to load or validate manifest: {e}")
        return None


def check_system_tool(tool_name, check_cmd_override=None):
    """Checks if a system tool exists using Windows 'where' command."""
    cmd = check_cmd_override or f"{DEPENDENCY_CONFIG['system_check_cmd']} {tool_name}"
    try:
        subprocess.check_call(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


def get_installed_python_packages():
    """
    Returns a mapping of installed pip packages (normalized names) to versions.
    """
    try:
        result = subprocess.check_output(
            DEPENDENCY_CONFIG["pip_check_cmd"],
            text=True,
            stderr=subprocess.STDOUT,
        )
        installed = {}
        for line in result.splitlines():
            if "==" in line:
                name, version = line.split("==", 1)
                installed[name.lower()] = version.strip()
            elif "@" in line:
                name, version = line.split("@", 1)
                installed[name.lower()] = version.strip()
        return installed
    except subprocess.CalledProcessError as e:
        output = e.output or ""
        logger.error(f"Failed to list pip packages (exit {e.returncode}): {output}")
        if "Execution Policy" in output or "cannot be loaded because running scripts is disabled" in output:
            logger.error(
                "Detected a possible PowerShell execution policy issue while running pip. "
                "Please try using 'python -m pip' in PPF_PIP_CMD or adjust your execution policy."
            )
        return {}
    except Exception as e:
        logger.error(f"Failed to list pip packages: {e}")
        return {}


def parse_version(version_str):
    """
    Parse a simple version string like '1.2.3' into a tuple of ints.
    Non-numeric segments are ignored after the numeric prefix.
    """
    parts = []
    for part in version_str.split("."):
        num = ""
        for ch in part:
            if ch.isdigit():
                num += ch
            else:
                break
        if num:
            parts.append(int(num))
        else:
            break
    return tuple(parts)


def compare_versions(installed, spec):
    """
    Compare an installed version string against a simple spec like '==1.2.3' or '>=1.2.3'.

    Returns:
        'ok', 'conflict', or 'unknown' for unsupported patterns.
    """
    if not spec:
        return "ok"

    spec = spec.strip()
    if spec.startswith("=="):
        target = spec[2:].strip()
        return "ok" if installed == target else "conflict"

    if spec.startswith(">="):
        target = spec[2:].strip()
        inst_tuple = parse_version(installed)
        target_tuple = parse_version(target)
        if not inst_tuple or not target_tuple:
            return "unknown"
        return "ok" if inst_tuple >= target_tuple else "conflict"

    # Unsupported pattern (e.g., <=, !=, complex specs)
    return "unknown"


def load_plugin_requirements(plugin_path):
    """
    Load additional Python requirements from a plugin-local requirements.txt if present.
    Returns a mapping name -> spec_string.
    """
    req_path = os.path.join(plugin_path, "requirements.txt")
    requirements = {}
    if not os.path.exists(req_path):
        return requirements

    try:
        with open(req_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "==" in line:
                    name, version = line.split("==", 1)
                    requirements[name.strip().lower()] = f"=={version.strip()}"
                elif ">=" in line:
                    name, version = line.split(">=", 1)
                    requirements[name.strip().lower()] = f">={version.strip()}"
                else:
                    # No explicit operator; treat as existence requirement only.
                    requirements[line.lower()] = ""
    except Exception as e:
        logger.error(f"Failed to parse plugin requirements.txt: {e}")
        requirements["__requirements_error__"] = str(e)
    return requirements


def detect_python_conflicts(manifest, plugin_path, installed_packages):
    """
    Detect version conflicts between plugin requirements and installed packages.

    Returns a dict structure with 'python' key listing conflict entries.
    """
    conflicts = {"python": []}

    deps = manifest.get("dependencies", {})
    manifest_reqs = deps.get("python", []) or []
    plugin_reqs_file = load_plugin_requirements(plugin_path)

    # Build a combined view of requirements: name -> {manifest_spec, file_spec}
    combined = {}
    for req in manifest_reqs:
        name = req.get("name", "").lower()
        if not name:
            continue
        combined.setdefault(name, {})["manifest_spec"] = req.get("version", "") or ""
    for name, spec in plugin_reqs_file.items():
        if name == "__requirements_error__":
            continue
        combined.setdefault(name, {})["file_spec"] = spec

    # Internal mismatch between manifest and requirements.txt
    for name, specs in combined.items():
        manifest_spec = specs.get("manifest_spec", "")
        file_spec = specs.get("file_spec", "")
        if manifest_spec and file_spec and manifest_spec != file_spec:
            conflicts["python"].append(
                {"name": name, "type": "internal_mismatch", "manifest_spec": manifest_spec, "file_spec": file_spec}
            )

    # Environment conflicts based on installed versions
    for name, specs in combined.items():
        required_spec = specs.get("file_spec") or specs.get("manifest_spec") or ""
        installed_version = installed_packages.get(name)
        if not installed_version or not required_spec:
            continue

        status = compare_versions(installed_version, required_spec)
        if status == "conflict":
            conflicts["python"].append(
                {
                    "name": name,
                    "type": "version_conflict",
                    "required_spec": required_spec,
                    "installed_version": installed_version,
                }
            )
        elif status == "unknown":
            conflicts["python"].append(
                {
                    "name": name,
                    "type": "spec_unsupported",
                    "required_spec": required_spec,
                    "installed_version": installed_version,
                }
            )

    # Handle malformed requirements.txt
    if "__requirements_error__" in plugin_reqs_file:
        conflicts["python"].append(
            {
                "name": "__plugin_requirements__",
                "type": "requirements_file_error",
                "error": plugin_reqs_file["__requirements_error__"],
            }
        )

    return conflicts


def get_installed_npm_packages(plugin_path):
    """Returns a set of installed npm packages in the plugin directory."""
    if not os.path.exists(os.path.join(plugin_path, "package.json")):
        return set()

    try:
        result = subprocess.check_output(
            DEPENDENCY_CONFIG["npm_check_cmd"],
            cwd=plugin_path,
            text=True,
            stderr=subprocess.STDOUT,
        )
        data = json.loads(result)
        dependencies = data.get("dependencies", {})
        return set(name.lower() for name in dependencies.keys())
    except subprocess.CalledProcessError as e:
        output = e.output or ""
        logger.error(f"Failed to list npm packages (exit {e.returncode}): {output}")
        if "Execution Policy" in output or "cannot be loaded because running scripts is disabled" in output:
            logger.error(
                "Detected a possible PowerShell execution policy issue while running npm. "
                "Ensure npm.cmd is on PATH and that your execution policy allows it to run."
            )
        return set()
    except Exception as e:
        logger.error(f"Failed to list npm packages: {e}")
        return set()


def audit_dependencies(plugin_path):
    """
    Scans the manifest and checks against installed packages.
    """
    # --- ENVIRONMENT CHECK START ---
    env_info = detect_windows_native_environment()
    if not env_info.is_supported:
        return {
            "success": False,
            "error": env_info.message,
        }
    # --- PREFLIGHT CHECK START ---
    env_result = run_preflight_env_check()
    if not env_result.get("ok", False):
        return {
            "success": False,
            "error": env_result.get(
                "summary",
                "Environment diagnostics failed; required tools are missing or misconfigured.",
            ),
        }
    # --- PREFLIGHT CHECK END ---

    # --- COMMAND VALIDATION START ---
    try:
        _validate_dependency_commands()
    except RuntimeError as exc:
        return {"success": False, "error": str(exc)}
    # --- COMMAND VALIDATION END ---

    # --- STRICT CHECK START ---
    env_check = validate_environment()
    if not env_check["valid"]:
        return {"success": False, "error": env_check["error"]}
    # --- STRICT CHECK END ---

    manifest = load_manifest(plugin_path)
    if not manifest:
        return {"success": False, "error": "Manifest missing or invalid"}

    deps = manifest.get("dependencies", {})
    missing = {"python": [], "npm": [], "system": []}
    conflicts = {"python": []}

    # 1. Check Python
    if "python" in deps:
        installed_pip = get_installed_python_packages()
        for req in deps["python"]:
            name = req["name"].lower()
            if name not in installed_pip:
                missing["python"].append(req)
        # Detect version conflicts (non-destructive)
        conflicts = detect_python_conflicts(manifest, plugin_path, installed_pip)

    # 2. Check NPM
    if "npm" in deps:
        installed_npm = get_installed_npm_packages(plugin_path)
        for req in deps["npm"]:
            name = req["name"].lower()
            if name not in installed_npm:
                missing["npm"].append(req)

    # 3. Check System
    if "system" in deps:
        for req in deps["system"]:
            name = req["name"]
            cmd = req.get("check_cmd")
            if not check_system_tool(name, cmd):
                missing["system"].append(req)

    # Restart guidance is only relevant when system tools are missing.
    system_restart_required = bool(missing["system"])
    system_restart_message = None
    if system_restart_required:
        system_restart_message = (
            "One or more system tools are missing. After installing them, "
            "please restart Piovis Studio (or the built app) so it can see "
            "the updated PATH, then re-run this dependency check."
        )
        logger.warning(system_restart_message)

    return {
        "success": True,
        "plugin_name": manifest.get("name", "unknown"),
        "missing": missing,
        "conflicts": conflicts,
        "system_restart_required": system_restart_required,
        "system_restart_message": system_restart_message,
    }


def install_dependencies(plugin_path, audit_result):
    """
    Installs missing dependencies identified by the audit.
    """
    # --- STRICT CHECK START ---
    env_check = validate_environment()
    if not env_check["valid"]:
        return {"success": False, "error": env_check["error"]}
    # --- STRICT CHECK END ---

    if not audit_result["success"]:
        return {"success": False, "error": audit_result.get("error")}

    missing = audit_result["missing"]
    errors = []

    # 1. Install Python
    for req in missing["python"]:
        name = req["name"]
        version = req.get("version", "")
        pkg_spec = f"{name}{version}"

        logger.info(f"Installing Python package: {pkg_spec}")
        cmd = DEPENDENCY_CONFIG["pip_install_cmd"] + [pkg_spec]

        try:
            subprocess.check_call(cmd)
        except subprocess.CalledProcessError:
            errors.append(f"Failed to install pip package: {name}")

    # 2. Install NPM
    if missing["npm"]:
        pkg_json_path = os.path.join(plugin_path, "package.json")
        if not os.path.exists(pkg_json_path):
            logger.info("Creating basic package.json...")
            subprocess.run(["npm.cmd", "init", "-y"], cwd=plugin_path, shell=True)

        for req in missing["npm"]:
            name = req["name"]
            version = req.get("version", "")
            pkg_spec = f"{name}@{version}" if version else name

            logger.info(f"Installing NPM package: {pkg_spec}")
            cmd = DEPENDENCY_CONFIG["npm_install_cmd"] + [pkg_spec]

            try:
                subprocess.check_call(cmd, cwd=plugin_path, shell=True)
            except subprocess.CalledProcessError:
                errors.append(f"Failed to install npm package: {name}")

    # 3. System Tools (Report only)
    for req in missing["system"]:
        errors.append(
            "System tool missing: {name}. Download from: {url}. "
            "After installing, restart Piovis Studio (or the built app) "
            "so it can see the updated PATH, then re-run this dependency check.".format(
                name=req["name"], url=req.get("install_url", "unknown")
            )
        )

    if errors:
        return {"success": False, "error": "; ".join(errors)}

    return {"success": True, "message": "All installable dependencies processed."}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python executor.py <path_to_plugin>")
        sys.exit(1)

    path = sys.argv[1]
    print(f"Auditing: {path}")

    audit = audit_dependencies(path)
    if audit["success"]:
        import json

        print(json.dumps(audit["missing"], indent=2))
    else:
        print(f"Error: {audit.get('error')}")
