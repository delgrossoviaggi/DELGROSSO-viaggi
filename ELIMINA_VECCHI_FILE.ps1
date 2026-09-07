$ErrorActionPreference = "Stop"
$repo = Get-Location
$keep = @('.git','GESTIONALE')
Write-Host "Pulizia della root del sito..." -ForegroundColor Yellow
Get-ChildItem $repo -Force | Where-Object { $keep -notcontains $_.Name } | ForEach-Object {
  Write-Host "Elimino: $($_.Name)"
  Remove-Item $_.FullName -Recurse -Force
}
Write-Host "OK. .git e GESTIONALE sono stati preservati." -ForegroundColor Green
Write-Host "Ora copia nella root i file del pacchetto SITO PULITO." -ForegroundColor Cyan
