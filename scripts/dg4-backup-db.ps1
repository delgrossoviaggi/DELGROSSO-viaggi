# DELGROSSO 4.0 — esportazione DB integrativa (SOLO LETTURA lato Supabase)
# Windows PowerShell 5.1+; richiede Supabase CLI e Docker Desktop avviato.
# NON e' un backup gestito completo della piattaforma: Auth e Storage richiedono
# controllo dello snapshot Supabase e copia separata degli oggetti Storage.
# Esempio: .\scripts\dg4-backup-db.ps1 -ProjectId chkuayhbmitdmzmmvona -OutputRoot 'D:\BACKUP-DELGROSSO'
#
# Autenticazione locale: supabase login (oppure SUPABASE_ACCESS_TOKEN in ambiente);
# password DB: la CLI la richiede o la legge da SUPABASE_DB_PASSWORD.
# NON incollare credenziali nei comandi, file SQL, repo o chat.

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('chkuayhbmitdmzmmvona','bhsanrbadsqcpbtxupmr')]
  [string]$ProjectId,
  [Parameter(Mandatory=$true)]
  [string]$OutputRoot
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw 'Supabase CLI non trovato. Installarlo e riprovare.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop non trovato.'
}
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop non e in esecuzione.' }
$resolvedRoot = [System.IO.Path]::GetFullPath($OutputRoot)
if (-not [System.IO.Path]::IsPathRooted($OutputRoot)) { throw 'OutputRoot deve essere un percorso assoluto.' }
New-Item -ItemType Directory -Path $resolvedRoot -Force | Out-Null
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$folder = Join-Path (Join-Path $resolvedRoot $ProjectId) $timestamp
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$workDir = Join-Path $folder '_workdir_locale'
New-Item -ItemType Directory -Path $workDir -Force | Out-Null
$failed=$true
Push-Location $workDir
try {
  # Modifiche solo a file LOCALI e configurazione della CLI. Nessuna DDL/DML remota.
  & supabase init --yes
  if ($LASTEXITCODE -ne 0) { throw 'supabase init fallito.' }
  & supabase link --project-ref $ProjectId
  if ($LASTEXITCODE -ne 0) { throw 'supabase link fallito: verificare login/password.' }

  $schemaList = if ($ProjectId -eq 'chkuayhbmitdmzmmvona') {
    'public,dg_private,dg_security_backup'
  } else { 'public' }

  & supabase db dump --linked --role-only -f (Join-Path $folder 'roles.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Export ruoli fallito.' }
  & supabase db dump --linked --schema $schemaList -f (Join-Path $folder 'schema.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Export schema fallito.' }
  & supabase db dump --linked --schema $schemaList --data-only --use-copy -f (Join-Path $folder 'data.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Export dati fallito.' }

  $outputs=@('roles.sql','schema.sql','data.sql')
  $checks=@()
  foreach($file in $outputs) {
    $p=Join-Path $folder $file
    if (-not (Test-Path -LiteralPath $p)) { throw "File mancante: $file" }
    $length=(Get-Item -LiteralPath $p).Length
    if ($length -eq 0) { throw "File vuoto: $file" }
    $hash=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash
    $checks+= [ordered]@{ file=$file; bytes=$length; sha256=$hash }
  }
  [ordered]@{
    project_id=$ProjectId
    exported_utc=(Get-Date).ToUniversalTime().ToString('o')
    note='Backup logico INTEGRATIVO: lo snapshot gestito Auth/Storage non e attestato'
    files=$checks
  } | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $folder 'db-manifest.json') -Encoding UTF8
  $failed=$false
  Write-Host "Export SQL integrativo completato. File e SHA-256 in: $folder"
  Write-Host 'ATTENZIONE: verificare snapshot gestito, Storage fisico e ripristino di prova.'
}
finally {
  Pop-Location
  if ($failed) {
    Write-Warning "Export INCOMPLETO nella cartella: $folder. Non considerarlo backup valido."
  }
}
