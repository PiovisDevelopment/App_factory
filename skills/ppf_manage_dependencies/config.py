# Dependency Management Configuration (Windows Native)
# Version: 2.0.0 (Universal + Secrets)
#
# This file defines the commands used to audit and install libraries.
# It includes Core Packages that should always be present.

import os
import shlex


def _split_cmd(value: str) -> list[str]:
    """Split an override command string into argv safely."""
    try:
        return shlex.split(value)
    except ValueError:
        # Fallback: simple split on whitespace
        return value.split()


DEPENDENCY_CONFIG = {
    # -------------------------------------------------------------------------
    # Python Configuration
    # -------------------------------------------------------------------------
    # Command to install Python packages
    'pip_install_cmd': ['pip', 'install'],

    # Command to list installed Python packages (for auditing)
    'pip_check_cmd': ['pip', 'freeze'],

    # Core packages that MUST be installed for the Kernel to work
    # python-dotenv: Required for loading secrets from .env
    'core_python_packages': ['python-dotenv'],

    # -------------------------------------------------------------------------
    # Node.js / NPM Configuration
    # -------------------------------------------------------------------------
    # On Windows, npm is usually a batch file (npm.cmd).
    # Using just 'npm' in subprocess often fails.
    'npm_install_cmd': ['npm.cmd', 'install'],

    # Command to list installed NPM packages (depth=0 for top-level only)
    'npm_check_cmd': ['npm.cmd', 'list', '--depth=0', '--json'],

    # -------------------------------------------------------------------------
    # System Tools Configuration
    # -------------------------------------------------------------------------
    # The Windows equivalent of 'which'. Returns exit code 0 if found.
    'system_check_cmd': 'where',

    # Timeout for checks (in seconds) to prevent hanging
    'command_timeout': 30
}

# Allow Environment Variable Overrides
# Useful if the user uses 'pip3' or a specific 'python -m pip'
pip_override = os.environ.get('PPF_PIP_CMD')
if pip_override:
    DEPENDENCY_CONFIG['pip_install_cmd'] = _split_cmd(pip_override)
    # For listing packages, prefer the same base command plus 'freeze' if not explicitly overridden.
    DEPENDENCY_CONFIG['pip_check_cmd'] = DEPENDENCY_CONFIG['pip_install_cmd'][:1] + ['freeze']

npm_override = os.environ.get('PPF_NPM_CMD')
if npm_override:
    DEPENDENCY_CONFIG['npm_install_cmd'] = [npm_override, 'install']
