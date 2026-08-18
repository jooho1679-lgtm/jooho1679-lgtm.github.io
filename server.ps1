$root = $PSScriptRoot
$port = 8791

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.254' } |
    Select-Object -First 1 -ExpandProperty IPAddress)

Write-Output "===================================================="
Write-Output " 경익운수 배차 알림 - 로컬 서버 실행 중"
Write-Output "===================================================="
Write-Output " 이 PC에서 확인:        http://localhost:$port/"
if ($ip) {
    Write-Output " 같은 Wi-Fi 휴대폰에서: http://$ip`:$port/"
}
Write-Output ""
Write-Output " 이 창을 닫으면 서버가 종료됩니다."
Write-Output "===================================================="

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
        $requestLine = $reader.ReadLine()
        while (($h = $reader.ReadLine()) -and $h.Trim() -ne "") { }

        $path = "/index.html"
        if ($requestLine -match '^[A-Z]+\s+(\S+)\s+HTTP') { $path = $matches[1] }
        $path = ($path -split '\?')[0]
        if ($path -eq "/") { $path = "/index.html" }
        $decodedPath = [System.Uri]::UnescapeDataString($path)
        $filePath = Join-Path $root ($decodedPath.TrimStart("/"))

        $writer = New-Object System.IO.BinaryWriter($stream)
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath)
            $ct = $mime[$ext]
            if (-not $ct) { $ct = "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $headerText = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
            $writer.Write([System.Text.Encoding]::ASCII.GetBytes($headerText))
            $writer.Write($bytes)
        } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes("Not found: $decodedPath")
            $headerText = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
            $writer.Write([System.Text.Encoding]::ASCII.GetBytes($headerText))
            $writer.Write($body)
        }
        $writer.Flush()
    } catch {
    } finally {
        $client.Close()
    }
}
