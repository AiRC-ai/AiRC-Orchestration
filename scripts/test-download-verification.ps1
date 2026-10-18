param(
    [string]$Repository = (Split-Path -Parent $PSScriptRoot),
    [string]$Revision
)

$ErrorActionPreference = 'Stop'
if ($Revision) {
    $document = (& git -C $Repository show "${Revision}:docs/VERIFY.md") -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read historical verification guide' }
} else {
    $document = Get-Content -Raw -LiteralPath (Join-Path $Repository 'docs/VERIFY.md')
}
$block = [regex]::Match($document, '(?s)```powershell\r?\n(.*?)\r?\n```')
if (-not $block.Success) { throw 'PowerShell verification example missing' }
$verify = [scriptblock]::Create($block.Groups[1].Value)
$root = Join-Path ([IO.Path]::GetTempPath()) ('airc-readme-' + [guid]::NewGuid())
$originalLocation = Get-Location
$failures = 0
$tests = @(
    @{ Name = 'valid'; Expected = $true },
    @{ Name = 'binary-marker'; Expected = $true },
    @{ Name = 'missing-installer'; Expected = $false },
    @{ Name = 'ambiguous-installers'; Expected = $false },
    @{ Name = 'wrong-filename'; Expected = $false },
    @{ Name = 'duplicate-entry'; Expected = $false },
    @{ Name = 'bad-hash'; Expected = $false }
)

try {
    New-Item -ItemType Directory -Path $root | Out-Null
    foreach ($test in $tests) {
        $directory = Join-Path $root $test.Name
        New-Item -ItemType Directory -Path $directory | Out-Null
        Set-Location $directory
        $name = 'AiRC-1.45.0+airc134-Setup.exe'
        [IO.File]::WriteAllText((Join-Path $directory $name), 'readme-only-checksum-fixture')
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $name).Hash.ToLowerInvariant()
        $entry = "$hash  $name"
        switch ($test.Name) {
            'binary-marker' { $entry = "$hash *$name" }
            'missing-installer' { Remove-Item -LiteralPath $name }
            'ambiguous-installers' { Copy-Item -LiteralPath $name -Destination 'AiRC-1.45.0+airc121-Setup.exe' }
            'wrong-filename' { $entry = "$hash  AiRC-1.45.0+airc121-Setup.exe" }
            'duplicate-entry' { $entry = "$entry`n$entry" }
            'bad-hash' { $entry = ('0' * 64) + "  $name" }
        }
        [IO.File]::WriteAllText((Join-Path $directory 'SHA256SUMS'), $entry + "`n")
        $accepted = $false
        try {
            & $verify | Out-Null
            $accepted = $true
        } catch {
            $accepted = $false
        }
        $passed = $accepted -eq $test.Expected
        if (-not $passed) { $failures++ }
        [pscustomobject]@{ test = $test.Name; passed = $passed; accepted = $accepted } |
            ConvertTo-Json -Compress
    }
} finally {
    Set-Location $originalLocation
    if (Test-Path -LiteralPath $root) { Remove-Item -Recurse -Force -LiteralPath $root }
}
if ($failures -ne 0) { throw "$failures verification-guide regressions failed" }
