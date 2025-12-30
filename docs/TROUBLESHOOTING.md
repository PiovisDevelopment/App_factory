# D089 - Troubleshooting Guide

> Solutions for common issues with App Factory and the plugin system.

## Quick Diagnosis

Run these commands to gather diagnostic information:

```bash
# Check application logs
type logs\launcher.log

# Check plugin logs
type logs\plugins.log

# Run in debug mode
start.bat --debug

# Run with console output
start.bat --console
```

---

## Application Issues

### Application Won't Start

#### Symptom
Double-clicking the executable or running `start.bat` does nothing.

#### Possible Causes & Solutions

**1. WebView2 Runtime Missing**

WebView2 is required for Tauri applications.

```batch
REM Check if WebView2 is installed
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
```

**Solution:** Download and install [Microsoft WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

**2. Missing Visual C++ Redistributable**

```batch
REM Check installed redistributables
wmic product where "name like 'Microsoft Visual C++ 2015-2022%'" get name
```

**Solution:** Download [Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe).

**3. Antivirus Blocking**

Some antivirus software blocks unsigned executables.

**Solution:**
- Add the application folder to your antivirus exclusion list
- Check quarantine for blocked files
- Temporarily disable antivirus to test

**4. Corrupted Installation**

**Solution:** Re-extract or reinstall the application.

---

### Application Crashes on Startup

#### Check the Logs

```batch
type logs\launcher.log | findstr /i "error"
```

#### Common Crashes

**1. Port Conflict (Not Applicable)**

App Factory uses stdio IPC, not network ports. If you see port errors, you may be running a different application.

**2. Configuration File Errors**

```batch
REM Validate JSON config
python -c "import json; json.load(open('config/project.json'))"
```

**Solution:** Fix JSON syntax errors or delete corrupted config files.

**3. Missing Dependencies**

Check for missing DLLs in Event Viewer:
1. Open Event Viewer (`eventvwr.msc`)
2. Navigate to Windows Logs > Application
3. Look for errors from your application

---

### Slow Application Startup

#### Causes

1. **Large Plugin Directory**: Many plugins take longer to discover
2. **Slow Disk**: SSD recommended for faster load times
3. **Antivirus Scanning**: Real-time scanning slows file access

#### Solutions

```batch
REM Move inactive plugins
mkdir plugins_disabled
move plugins\unused_plugin plugins_disabled\

REM Check plugin count
dir /b plugins | find /c /v ""
```

---

## Plugin Issues

### Plugin Not Discovered

#### Symptom
Plugin doesn't appear in the gallery.

#### Checklist

1. **Verify folder location**
   ```batch
   dir plugins\your_plugin\
   ```

2. **Check manifest exists**
   ```batch
   type plugins\your_plugin\manifest.json
   ```

3. **Validate manifest JSON**
   ```python
   import json
   with open("plugins/your_plugin/manifest.json") as f:
       data = json.load(f)
       print(f"Name: {data['name']}")
       print(f"Contract: {data['contract']}")
   ```

4. **Check folder name matches manifest name**
   ```
   Folder: plugins/tts_kokoro/
   Manifest: {"name": "tts_kokoro", ...}  ✓ Must match
   ```

---

### Plugin Won't Load

#### Error: "Plugin load failed"

**Cause:** Import error or missing dependencies.

**Diagnosis:**
```batch
python -c "import sys; sys.path.insert(0, 'plugins'); from tts_kokoro import Plugin"
```

**Solutions:**

1. **Install missing packages**
   ```batch
   pip install -r plugins\your_plugin\requirements.txt
   ```

2. **Check Python version**
   ```batch
   python --version
   REM Should be 3.11.x
   ```

3. **Verify contract class exists**
   ```python
   from your_plugin import Plugin
   print(Plugin.__bases__)  # Should include the contract class
   ```

---

### Plugin Initialization Failed

#### Error: "Plugin initialization failed"

**Cause:** `initialize()` method raised an exception.

**Diagnosis:**
```bash
# Check plugin logs
findstr /i "initialize" logs\plugins.log
```

**Common Causes:**

1. **Missing model files**
   ```python
   # In plugin
   async def initialize(self, config):
       model_path = Path(config["model_path"])
       if not model_path.exists():
           raise FileNotFoundError(f"Model not found: {model_path}")
   ```

2. **Invalid configuration**
   ```python
   # Validate config against schema
   async def initialize(self, config):
       if "required_key" not in config:
           raise ValueError("Missing required_key in config")
   ```

3. **GPU/CUDA issues**
   ```batch
   python -c "import torch; print(torch.cuda.is_available())"
   ```

---

### Plugin Health Check Failing

#### Symptom
Plugin shows "Error" or "Unhealthy" status.

#### Diagnosis

```json
// Send health check request
{"jsonrpc": "2.0", "method": "plugin/health", "params": {"name": "your_plugin"}, "id": 1}
```

**Common Causes:**

1. **Plugin crashed silently**
   - Check `logs/plugins.log` for exceptions

2. **Resource exhaustion**
   - Memory: Check Task Manager
   - GPU memory: `nvidia-smi`

3. **External service unavailable**
   - API endpoints may be down
   - Network connectivity issues

---

### Plugin Method Timeout

#### Error: "Request timeout"

**Cause:** Plugin method takes too long.

**Solutions:**

1. **Increase timeout**
   ```json
   {
     "method": "plugin/call",
     "params": {
       "plugin": "llm_ollama",
       "method": "complete",
       "args": {"prompt": "..."},
       "timeout": 120000
     }
   }
   ```

2. **Optimize plugin code**
   ```python
   # Use async properly
   async def slow_method(self, data):
       # Run CPU-bound work in thread pool
       result = await asyncio.to_thread(self._cpu_intensive, data)
       return result
   ```

3. **Check for deadlocks**
   - Review plugin code for blocking calls
   - Ensure proper async/await usage

---

## IPC Issues

### No Response from Plugin Host

#### Symptom
Commands hang indefinitely.

#### Diagnosis

```batch
REM Check if Plugin Host is running
tasklist | findstr python

REM Check for zombie processes
wmic process where "commandline like '%%plugins._host%%'" get processid,commandline
```

#### Solutions

1. **Kill and restart**
   ```batch
   taskkill /f /im python.exe
   start.bat
   ```

2. **Check stdout buffering**
   The Plugin Host requires unbuffered stdout:
   ```python
   # At top of __main__.py
   import sys
   import io
   sys.stdout = io.TextIOWrapper(
       sys.stdout.buffer, write_through=True
   )
   ```

3. **Verify JSON-RPC format**
   ```json
   // Valid request
   {"jsonrpc": "2.0", "method": "plugin/list", "params": {}, "id": 1}

   // Invalid (missing jsonrpc)
   {"method": "plugin/list", "params": {}, "id": 1}
   ```

---

### JSON Parse Errors

#### Error: "Parse error: Invalid JSON"

**Cause:** Malformed JSON in request or response.

**Common Issues:**

1. **Trailing comma**
   ```json
   {"key": "value",}  // ❌ Wrong
   {"key": "value"}   // ✓ Correct
   ```

2. **Single quotes**
   ```json
   {'key': 'value'}   // ❌ Wrong
   {"key": "value"}   // ✓ Correct
   ```

3. **Unescaped characters**
   ```json
   {"text": "Hello\nWorld"}  // Contains literal newline - problematic
   {"text": "Hello\\nWorld"} // ✓ Escaped
   ```

---

## Build Issues

### Export Fails

#### Error during export

**Diagnosis:**
```typescript
const result = await exportProject(projectState, plugins, config, (progress) => {
  console.log(`Step ${progress.step}: ${progress.description}`);
});
if (!result.success) {
  console.error(result.error);
}
```

**Common Causes:**

1. **Invalid output directory**
   - Path doesn't exist
   - No write permission
   - Path contains invalid characters

2. **Missing plugins**
   - Plugin specified in bundledPlugins not found

3. **Template errors**
   - Invalid template variables

---

### Tauri Build Errors

#### Common Build Issues

**1. Rust compilation errors**
```batch
cd src-tauri
cargo build --release 2>&1 | findstr /i "error"
```

**2. Missing Windows SDK**
Install Visual Studio Build Tools with:
- C++ build tools
- Windows 10/11 SDK

**3. Icon issues**
Ensure all icon sizes exist:
- icons/32x32.png
- icons/128x128.png
- icons/icon.ico

---

## Performance Issues

### High Memory Usage

#### Diagnosis

```batch
REM Check memory by process
wmic process where "name='python.exe'" get processid,workingsetsize
```

#### Solutions

1. **Unload unused plugins**
   ```json
   {"jsonrpc": "2.0", "method": "plugin/unload", "params": {"name": "unused_plugin"}, "id": 1}
   ```

2. **Configure resource limits**
   Edit `config/plugins.yaml`:
   ```yaml
   isolation:
     limits:
       max_memory_mb: 512
   ```

3. **Review plugin memory leaks**
   - Ensure models are unloaded in `shutdown()`
   - Clear caches periodically

---

### High CPU Usage

#### Diagnosis

```batch
REM Check CPU by process
wmic process where "name='python.exe'" get processid,percentprocessortime
```

#### Solutions

1. **Reduce health check frequency**
   Edit `config/plugins.yaml`:
   ```yaml
   health:
     interval: 60000  # Increase from 30000
   ```

2. **Disable file watching in production**
   ```yaml
   development:
     watch: false
   ```

---

## Network Issues

### API Plugins Failing

For plugins that use external APIs:

1. **Check connectivity**
   ```batch
   ping api.example.com
   ```

2. **Verify API keys**
   Check `.env` file for correct API keys

3. **Check rate limits**
   Review API provider dashboard

4. **Proxy settings**
   ```batch
   set HTTP_PROXY=http://proxy:8080
   set HTTPS_PROXY=http://proxy:8080
   ```

---

## Logging & Debugging

### Enable Debug Logging

```batch
REM Environment variable
set LOG_LEVEL=debug
set PLUGIN_HOST_LOG_LEVEL=debug

REM Or command line
python -m plugins._host --log-level DEBUG
```

### Log Locations

| Log | Location | Content |
|-----|----------|---------|
| Launcher | `logs/launcher.log` | Startup, environment |
| Plugins | `logs/plugins.log` | Plugin operations |
| Application | `logs/app.log` | General application |

### Reading Logs

```batch
REM Last 50 lines
powershell "Get-Content logs\plugins.log -Tail 50"

REM Filter errors
findstr /i "error exception" logs\plugins.log

REM Watch live
powershell "Get-Content logs\plugins.log -Wait"
```

---

## Recovery Procedures

### Reset to Clean State

```batch
REM Backup current config
xcopy /e /i config config_backup

REM Clear logs
del /q logs\*

REM Reset plugins
del /q config\plugins.yaml
copy templates\plugins.yaml.template config\plugins.yaml

REM Restart
start.bat
```

### Reinstall Plugin Host

```batch
REM Remove and reinstall dependencies
cd plugins\_host
pip uninstall -y -r requirements.txt
pip install -r requirements.txt
```

### Factory Reset

```batch
REM WARNING: This removes all user data
rmdir /s /q config
rmdir /s /q logs
rmdir /s /q data
rmdir /s /q cache

REM Restore defaults
mkdir config
mkdir logs
mkdir data
copy templates\.env.template .env
```

---

## Getting Help

### Before Reporting Issues

1. **Gather diagnostic info**
   ```batch
   echo === System Info === > diagnostics.txt
   systeminfo >> diagnostics.txt
   echo === Python Version === >> diagnostics.txt
   python --version >> diagnostics.txt
   echo === Installed Packages === >> diagnostics.txt
   pip list >> diagnostics.txt
   echo === Plugin List === >> diagnostics.txt
   dir plugins >> diagnostics.txt
   echo === Recent Errors === >> diagnostics.txt
   findstr /i "error" logs\plugins.log >> diagnostics.txt
   ```

2. **Check existing issues**
   - Search project issue tracker
   - Review closed issues for solutions

3. **Create minimal reproduction**
   - Isolate the problem
   - Create minimal plugin that demonstrates issue

### Reporting Issues

Include:
- App Factory version
- Windows version
- Python version
- Error messages
- Steps to reproduce
- Relevant log snippets

---

*Troubleshooting Guide Version: 1.0 | Last Updated: 2025-12-24*
