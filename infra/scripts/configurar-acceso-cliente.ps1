param(
  [string]$Ip,
  [string]$Hostname = 'contaduria.local'
)

$ErrorActionPreference = 'Stop'

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
  $arg = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
  if ($Ip) { $arg += @('-Ip', $Ip) }
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arg
  exit 0
}

$scriptDir = Split-Path -Parent $PSCommandPath
$ipFile = Join-Path $scriptDir 'oficina-ip.txt'

if (-not $Ip -and (Test-Path $ipFile)) {
  $Ip = (Get-Content -LiteralPath $ipFile -TotalCount 1).Trim()
}

if (-not $Ip) {
  $Ip = Read-Host 'IP actual del servidor (ej. 192.168.1.50)'
}

$Ip = $Ip.Trim()
if ($Ip -notmatch '^\d{1,3}(?:\.\d{1,3}){3}$') {
  Write-Host "IP invalida: $Ip"
  Write-Host 'Uso: configurar-acceso-cliente.bat 192.168.1.50'
  pause
  exit 1
}

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$line = "$Ip    $Hostname"
$raw = Get-Content -LiteralPath $hostsPath
$pattern = '^\s*\d{1,3}(?:\.\d{1,3}){3}\s+' + [regex]::Escape($Hostname) + '\s*$'
$out = New-Object System.Collections.Generic.List[string]
$replaced = $false
foreach ($l in $raw) {
  if ($l -match $pattern) {
    [void]$out.Add($line)
    $replaced = $true
  } else {
    [void]$out.Add($l)
  }
}
if (-not $replaced) {
  [void]$out.Add($line)
}

Set-Content -LiteralPath $hostsPath -Value $out -Encoding ASCII

Write-Host ''
Write-Host "Listo. Esta PC apunta $Hostname a $Ip"
Write-Host 'Abra Chrome o Edge en:'
Write-Host "  https://${Hostname}:3000"
Write-Host ''
Write-Host 'Si es la primera vez, instale rootCA.pem (misma carpeta)'
Write-Host 'en Entidades de certificacion raiz de confianza.'
Write-Host ''
pause
