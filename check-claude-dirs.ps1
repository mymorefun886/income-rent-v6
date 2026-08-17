Write-Host "=== Claude Desktop dirs ==="
Get-ChildItem "$env:USERPROFILE\.claude" -Directory -ErrorAction SilentlyContinue | Select-Object Name

Write-Host ""
Write-Host "=== Z: drive dirs ==="
Get-ChildItem Z:\ -Directory -ErrorAction SilentlyContinue | Select-Object Name

Write-Host ""
Write-Host "=== Claude sessions size ==="
$sessionsPath = "$env:USERPROFILE\.claude\sessions"
if (Test-Path $sessionsPath) {
    $size = (Get-ChildItem $sessionsPath -Recurse | Measure-Object -Property Length -Sum).Sum
    Write-Host "Sessions: $([math]::Round($size/1MB, 2)) MB"
} else {
    Write-Host "No sessions dir"
}
