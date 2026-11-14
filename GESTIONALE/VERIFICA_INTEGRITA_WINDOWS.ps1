#Requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$manifest = Join-Path $PSScriptRoot 'SHA256_FILES.txt'
if (-not (Test-Path -LiteralPath $manifest)) { Write-Host 'Manifesto SHA256 mancante' -ForegroundColor Red; exit 2 }
$errors = @()
$total = 0
foreach ($line in Get-Content -LiteralPath $manifest -Encoding UTF8) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }
    if ($line -notmatch '^([0-9a-fA-F]{64})  (.+)$') { $errors += 'Riga non valida nel manifesto'; continue }
    $hash = $Matches[1].ToLowerInvariant()
    $rel = $Matches[2].Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    if ($rel.Contains('..') -or [System.IO.Path]::IsPathRooted($rel)) { $errors += 'Percorso non ammesso'; continue }
    $path = Join-Path $PSScriptRoot $rel
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { $errors += "File mancante: $rel"; continue }
    $computed = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($computed -ne $hash) { $errors += "File non coincidente: $rel" }
    $total++
}
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    Write-Host 'VERIFICA FALLITA: reinstallare i file corretti.' -ForegroundColor Red
    exit 1
}
Write-Host "VERIFICA SUPERATA: $total file integri" -ForegroundColor Green
exit 0
