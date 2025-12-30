$ports = @(1420,1421)

foreach ($p in $ports) {
  $listeners = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
  foreach ($l in $listeners) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($l.OwningProcess)" -ErrorAction SilentlyContinue
    if ($proc -and ($proc.Name -ieq "node.exe")) {
      Write-Host "Killing stale node.exe process on port $p (PID: $($l.OwningProcess))"
      Stop-Process -Id $l.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

# Important: keep Vite running (Tauri expects this to stay alive)
npm run dev
