#!/usr/bin/env python3
"""
PPF Component Generator Executor (Universal)
"""

import sys
import os
import json
import logging

# Add current directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from config import (
    MANIFEST_TEMPLATE, 
    CONTRACT_TEMPLATE, 
    PLUGIN_TEMPLATE, 
    TS_INTERFACE_TEMPLATE,
    TYPE_MAP
)
from heavy_libs import detect_heavy_libraries

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger("ComponentGen")

def to_pascal_case(snake_str):
    """Converts snake_case to PascalCase."""
    return "".join(x.capitalize() for x in snake_str.lower().split("_"))

def to_camel_case(snake_str):
    """Converts snake_case to camelCase."""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def map_type_to_ts(py_type):
    """Maps Python types to TypeScript types."""
    return TYPE_MAP.get(py_type, "any")

def generate_component(data):
    """
    Main entry point. Generates all files for the component.
    
    Args:
        data (dict): {
            "name": "stock_data",
            "domain": "finance",
            "description": "...",
            "methods": [...],
            "dependencies": {...}
        }
    """
    name = data['name']
    domain = data['domain']
    class_name = to_pascal_case(name)
    contract_class = f"{to_pascal_case(domain)}Contract"

    python_deps = data.get('dependencies', {}).get('python', []) or []
    heavy_libs = detect_heavy_libraries(python_deps)
    if heavy_libs:
        logger.warning(
            "Heavy Python libraries detected for plugin '%s': %s. "
            "These packages can significantly increase environment size "
            "and may conflict with other plugins. Consider using a dedicated "
            "virtual environment or project for this plugin.",
            name,
            ", ".join(heavy_libs),
        )
    
    # 1. Define Paths
    # Assuming script runs from project root or we use relative paths
    # Adjust base_path if needed
    base_path = os.getcwd() 
    plugin_dir = os.path.join(base_path, "plugins", f"{name}_plugin")
    contracts_dir = os.path.join(base_path, "contracts")
    types_dir = os.path.join(base_path, "src", "types")

    # Create directories
    os.makedirs(plugin_dir, exist_ok=True)
    os.makedirs(contracts_dir, exist_ok=True)
    os.makedirs(types_dir, exist_ok=True)

    # 2. Generate Manifest (component.yaml)
    manifest_content = _build_manifest(data, class_name)
    with open(os.path.join(plugin_dir, "component.yaml"), "w") as f:
        f.write(manifest_content)

    # 3. Generate Contract (contracts/{domain}.py)
    # Note: This might overwrite existing domain contracts. 
    # In a real scenario, we might want to append or merge.
    contract_content = _build_contract(data, class_name, contract_class)
    contract_path = os.path.join(contracts_dir, f"{domain}.py")
    with open(contract_path, "w") as f:
        f.write(contract_content)

    # 4. Generate Plugin (plugins/{name}_plugin/plugin.py)
    plugin_content = _build_plugin(data, class_name, contract_class)
    with open(os.path.join(plugin_dir, "plugin.py"), "w") as f:
        f.write(plugin_content)

    # 5. Generate TypeScript Types (src/types/{domain}.ts)
    ts_content = _build_ts_interfaces(data, class_name)
    with open(os.path.join(types_dir, f"{domain}.ts"), "w") as f:
        f.write(ts_content)

    # 6. Create empty __init__.py files
    open(os.path.join(plugin_dir, "__init__.py"), 'a').close()
    open(os.path.join(contracts_dir, "__init__.py"), 'a').close()

    return {
        "success": True,
        "path": plugin_dir,
        "contract_path": contract_path,
        "heavy_libraries": heavy_libs
    }

def _build_manifest(data, class_name):
    """Builds the YAML manifest string."""
    # Format methods for YAML
    methods_yaml = ""
    for m in data['methods']:
        methods_yaml += f"    - name: \"{m['name']}\"\n"
        methods_yaml += f"      is_async: {str(m.get('is_async', True)).lower()}\n"
        inputs = m.get('inputs', {}) or {}
        outputs = m.get('outputs', {}) or {}
        methods_yaml += f"      inputs:\n"
        if inputs:
            for field, typ in inputs.items():
                methods_yaml += f"        {field}: \"{typ}\"\n"
        else:
            methods_yaml += "        {}\n"
        methods_yaml += f"      outputs:\n"
        if outputs:
            for field, typ in outputs.items():
                methods_yaml += f"        {field}: \"{typ}\"\n"
        else:
            methods_yaml += "        {}\n"
    
    # Format dependencies
    py_deps = ""
    for d in data.get('dependencies', {}).get('python', []):
        py_deps += f"    - name: \"{d['name']}\"\n      version: \"{d.get('version', '')}\"\n"
    
    npm_deps = ""
    for d in data.get('dependencies', {}).get('npm', []):
        npm_deps += f"    - name: \"{d['name']}\"\n      version: \"{d.get('version', '')}\"\n"
        
    sys_deps = ""
    for d in data.get('dependencies', {}).get('system', []):
        sys_deps += f"    - name: \"{d['name']}\"\n      check_cmd: \"{d.get('check_cmd', '')}\"\n"

    return MANIFEST_TEMPLATE.format(
        name=data['name'],
        description=data.get('description', ''),
        domain=data['domain'],
        methods_yaml=methods_yaml,
        python_deps_yaml=py_deps,
        npm_deps_yaml=npm_deps,
        system_deps_yaml=sys_deps,
        class_name=class_name
    )

def _build_contract(data, class_name, contract_class):
    """Builds the Python Contract with Pydantic models."""
    models = ""
    abstract_methods = ""
    
    for m in data['methods']:
        method_pascal = to_pascal_case(m['name'])
        
        # Request Model
        models += f"class {method_pascal}Request(BaseModel):\n"
        if not m['inputs']:
            models += "    pass\n\n"
        else:
            for k, v in m['inputs'].items():
                models += f"    {k}: {v}\n"
            models += "\n"
            
        # Response Model
        models += f"class {method_pascal}Response(BaseModel):\n"
        if not m['outputs']:
            models += "    pass\n\n"
        else:
            for k, v in m['outputs'].items():
                models += f"    {k}: {v}\n"
            models += "\n"

        # Abstract Method
        abstract_methods += f"    @abstractmethod\n"
        abstract_methods += f"    async def {m['name']}(self, request: {method_pascal}Request) -> {method_pascal}Response:\n"
        abstract_methods += f"        pass\n\n"

    return CONTRACT_TEMPLATE.format(
        domain=data['domain'],
        data_models=models,
        class_name=to_pascal_case(data['domain']), # Domain contract name
        abstract_methods=abstract_methods
    )

def _build_plugin(data, class_name, contract_class):
    """Builds the Plugin implementation."""
    imports = ""
    # Add dependency imports if known (simple heuristic)
    for d in data.get('dependencies', {}).get('python', []):
        imports += f"import {d['name'].replace('-', '_')}\n"

    import_models = []
    method_impls = ""
    
    for m in data['methods']:
        method_pascal = to_pascal_case(m['name'])
        req_cls = f"{method_pascal}Request"
        res_cls = f"{method_pascal}Response"
        import_models.extend([req_cls, res_cls])
        
        method_impls += f"    async def {m['name']}(self, request: {req_cls}) -> {res_cls}:\n"
        method_impls += f"        logger.info(f'Executing {m['name']}')\n"
        method_impls += f"        # TODO: Implement logic using {imports.strip() if imports else 'libs'}\n"
        method_impls += f"        return {res_cls}()\n\n"

    return PLUGIN_TEMPLATE.format(
        name=data['name'],
        domain=data['domain'],
        contract_class=contract_class,
        import_models=", ".join(import_models),
        imports=imports,
        class_name=class_name,
        method_implementations=method_impls
    )

def _build_ts_interfaces(data, class_name):
    """Builds TypeScript interfaces."""
    interfaces = ""
    signatures = ""
    
    for m in data['methods']:
        method_pascal = to_pascal_case(m['name'])
        
        # Request Interface
        interfaces += f"export interface {method_pascal}Request {{\n"
        for k, v in m['inputs'].items():
            interfaces += f"  {k}: {map_type_to_ts(v)};\n"
        interfaces += "}\n\n"
        
        # Response Interface
        interfaces += f"export interface {method_pascal}Response {{\n"
        for k, v in m['outputs'].items():
            interfaces += f"  {k}: {map_type_to_ts(v)};\n"
        interfaces += "}\n\n"
        
        # API Signature
        signatures += f"  {m['name']}(req: {method_pascal}Request): Promise<{method_pascal}Response>;\n"

    return TS_INTERFACE_TEMPLATE.format(
        domain=data['domain'],
        interfaces=interfaces,
        class_name=class_name,
        method_signatures=signatures
    )

if __name__ == "__main__":
    # CLI Test
    if len(sys.argv) > 1:
        # In real usage, we'd parse a JSON file passed as arg
        print("Usage: Import generate_component in your skill logic.")
