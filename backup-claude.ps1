# Backup: local .claude -> NAS Z: drive
# Mirror only. Never deletes local files.

$localDir = "$env:USERPROFILE\.claude"
$nasDir = "Z:\claude-data-backup"

Write-Host "=== Claude Backup: local -> NAS ==="

# Ensure NAS is reachable
if (-not (Test-Path "Z:\")) {
    Write-Host "Z: not mounted, trying to mount..."
    net use Z: "\\192.168.9.2\hermes-agent" /persistent:yes 2>&1 | Out-Null
    if (-not (Test-Path "Z:\")) {
        Write-Host "FAILED: Cannot access NAS"
        exit 1
    }
}

# Create backup dir
New-Item -ItemType Directory -Path $nasDir -Force | Out-Null

# Mirror sync (NAS mirrors local, local untouched)
Write-Host "Syncing..."
robocopy $localDir $nasDir /MIR /R:2 /W:2 /NP /NDL /XD "cache" "*.tmp"
$code = $LASTEXITCODE
if ($code -ge 8) {
    Write-Host "WARNING: robocopy exit code $code"
} else {
    Write-Host "OK: backup complete -> $nasDir"
}

Write-Host "Done."
