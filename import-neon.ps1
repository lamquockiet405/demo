# Copy the Neon DIRECT connection string to the clipboard before running.
# The SQL dump contains DROP statements, so only an empty database is accepted.
param(
    [string]$SqlFile = (Join-Path $PSScriptRoot 'kidmeal_full_utf8.sql')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $SqlFile -PathType Leaf)) {
    throw "SQL file not found: $SqlFile"
}

$psql = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) {
    $command = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $command) { throw 'psql is not installed. Install PostgreSQL client 16 or newer.' }
    $psql = $command.Source
}

$raw = Get-Clipboard -Raw
$match = [regex]::Match($raw, '(?i)\bpostgres(?:ql)?://[^\s''"<>]+')
if (-not $match.Success) {
    throw 'Clipboard has no PostgreSQL URL. Copy the direct connection string from Neon > Connect.'
}
$uri = [uri]$match.Value
$raw = $null
$match = $null
try { Set-Clipboard -Value '' } catch { Write-Warning 'Clear the clipboard manually after import.' }

$credentials = $uri.UserInfo.Split(':', 2)
if ($credentials.Count -ne 2 -or -not $uri.Host -or -not $uri.AbsolutePath) {
    throw 'The Neon connection string is incomplete.'
}
$env:PGHOST = $uri.DnsSafeHost
$env:PGPORT = if ($uri.IsDefaultPort) { '5432' } else { [string]$uri.Port }
$env:PGUSER = [uri]::UnescapeDataString($credentials[0])
$env:PGPASSWORD = [uri]::UnescapeDataString($credentials[1])
$env:PGDATABASE = [uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
$env:PGSSLMODE = 'require'
$uri = $null
$credentials = $null

try {
    $count = & $psql -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot connect to Neon. Check the copied direct URL and network.' }
    if ([int]$count -ne 0) {
        throw "Neon already has $count public tables. Import stopped to avoid replacing existing data."
    }

    Write-Host 'Database is empty. Importing SQL into Neon...' -ForegroundColor Cyan
    & $psql -X -v ON_ERROR_STOP=1 -f (Resolve-Path -LiteralPath $SqlFile).Path
    if ($LASTEXITCODE -ne 0) { throw 'Import failed. The database may now be partially populated; inspect the first SQL error before retrying.' }

    $count = & $psql -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';"
    if ($LASTEXITCODE -ne 0 -or [int]$count -ne 66) {
        throw "Import finished but expected 66 public tables; found $count."
    }
    Write-Host 'Neon import complete: 66 public tables.' -ForegroundColor Green
} finally {
    foreach ($name in @('PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE')) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
}
