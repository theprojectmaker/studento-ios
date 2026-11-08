# Exports the old Cloudflare D1 tables to JSON files for: node scripts/firebase-setup.mjs <sa.json> --migrate --from <dir>
# Usage: & scripts\export-d1.ps1 <output dir>   (needs wrangler logged in)
param([Parameter(Mandatory = $true)][string]$Out)
Set-Location (Join-Path $PSScriptRoot '..\server')
New-Item -ItemType Directory -Force $Out | Out-Null
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$q = [ordered]@{
  users       = 'SELECT id, username, salt, hash, is_admin, created_at FROM users'
  user_data   = 'SELECT user_id, data, updated_at FROM user_data'
  schools     = 'SELECT id, name, name_lc, created_by, created_at, hidden FROM schools'
  schedules   = 'SELECT id, school_id, name, days, created_by, created_at, hidden FROM schedules'
  reports     = 'SELECT id, kind, target_id, target_name, reason, note, user_id, status, created_at FROM reports'
  share_codes = "SELECT code, data, created_at, expires_at FROM share_codes WHERE expires_at > $now"
  messages    = 'SELECT id, from_id, to_id, body, created_at, read_at FROM messages ORDER BY id'
  blocks      = 'SELECT user_id, blocked_id FROM blocks'
  config      = 'SELECT key, value FROM config'
}
foreach ($k in $q.Keys) {
  Write-Host "exporting $k"
  npx --yes wrangler@4.128.0 d1 execute studento-db --remote --json --command $q[$k] | Out-File -Encoding utf8 (Join-Path $Out "$k.json")
}
Write-Host 'DONE-EXPORT'
