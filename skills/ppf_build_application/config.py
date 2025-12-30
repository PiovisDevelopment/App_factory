# Build Configuration
#
# This file defines the commands used to compile the application.
# It allows you to switch between npm/yarn/pnpm or add build flags.

import os

BUILD_CONFIG = {
    # The command to trigger the Tauri build
    # Default: npm run tauri build
    # Debug mode: npm run tauri build -- --debug
    'build_cmd': ['npm.cmd', 'run', 'tauri', 'build'],

    # Path to the Tauri configuration file (relative to project root)
    'tauri_conf_path': os.path.join('src-tauri', 'tauri.conf.json'),

    # Output directories where artifacts are stored (relative to src-tauri/target/release/bundle)
    'artifact_dirs': {
        'msi': 'msi',
        'exe': 'nsis',
        'dmg': 'dmg',   # MacOS (future proofing)
        'deb': 'deb'    # Linux (future proofing)
    }
}

# Allow Environment Variable Overrides
# Example: Set PPF_BUILD_CMD="yarn tauri build"
if os.environ.get('PPF_BUILD_CMD'):
    BUILD_CONFIG['build_cmd'] = os.environ['PPF_BUILD_CMD'].split()