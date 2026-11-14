#Requires -Version 5.1
# DELGROSSO VIAGGI Premium - mini server HTTP SOLO su 127.0.0.1.
# Usa .NET incluso in Windows; non richiede Python, Node, IIS o privilegi amministrativi.
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootWithSlash = $root.TrimEnd([char]'\', [char]'/') + [System.IO.Path]::DirectorySeparatorChar
$hostAddress = [System.Net.IPAddress]::Parse('127.0.0.1')
$port = 8787
$listener = [System.Net.Sockets.TcpListener]::new($hostAddress, $port)
try {
    $listener.Start()
} catch {
    Write-Host 'La porta 8787 e gia in uso oppure il sistema ne impedisce l apertura.' -ForegroundColor Red
    Write-Host 'Chiudere la finestra del gestionale gia avviato e riprovare.'
    Read-Host 'Premi Invio per chiudere'
    exit 1
}
Write-Host 'DELGROSSO VIAGGI 3.0 Premium - accesso Nicola / Raffaele' -ForegroundColor Cyan
Write-Host 'Server locale: http://127.0.0.1:8787/'
Write-Host 'Non richiede Python o Node. Per terminare premi Ctrl+C o chiudi questa finestra.'
try { Start-Process 'http://127.0.0.1:8787/' } catch { Write-Host 'Aprire il link nel browser preferito.' }
function Reply($client, [int]$code, [string]$reason, [byte[]]$body, [string]$mime='text/plain; charset=utf-8', [bool]$headOnly=$false) {
    $stream = $client.GetStream()
    $responseHeaders = "HTTP/1.1 $code $reason`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nX-Frame-Options: DENY`r`nReferrer-Policy: no-referrer`r`n`r`n"
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($responseHeaders)
    $stream.Write($bytes, 0, $bytes.Length)
    if (-not $headOnly -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}
$empty = [byte[]]@()
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 8000
            $client.SendTimeout = 8000
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 2048, $true)
            $line = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            $parts = $line.Split(' ')
            if ($parts.Length -lt 2) { Reply $client 400 'Bad Request' $empty; continue }
            $method = $parts[0]
            if ($method -ne 'GET' -and $method -ne 'HEAD') { Reply $client 405 'Method Not Allowed' $empty; continue }
            $headOnly = $method -eq 'HEAD'
            $target = $parts[1].Split('?')[0]
            try { $relative = [System.Uri]::UnescapeDataString($target).TrimStart('/').Replace('/', '\') }
            catch { Reply $client 400 'Bad Request' $empty; continue }
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
            try { $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relative)) }
            catch { Reply $client 400 'Bad Request' $empty; continue }
            if (-not $fullPath.StartsWith($rootWithSlash, [System.StringComparison]::OrdinalIgnoreCase)) {
                Reply $client 403 'Forbidden' $empty; continue
            }
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
            $mimes = @{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.png'='image/png';'.jpg'='image/jpeg';'.jpeg'='image/jpeg';'.ico'='image/x-icon';'.svg'='image/svg+xml';'.webp'='image/webp'}
            if (-not $mimes.ContainsKey($ext) -or -not [System.IO.File]::Exists($fullPath)) {
                Reply $client 404 'Not Found' $empty; continue
            }
            $content = [System.IO.File]::ReadAllBytes($fullPath)
            Reply $client 200 'OK' $content $mimes[$ext] $headOnly
        } catch {
            Write-Host 'Richiesta locale non riuscita; aggiorna il browser per riprovare.'
        } finally {
            if ($client) { $client.Close(); $client.Dispose() }
        }
    }
} finally {
    $listener.Stop()
}
