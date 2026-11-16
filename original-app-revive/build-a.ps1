<#
.SYNOPSIS
  Rebuilds the original Pix Backpack v1.40 APK so it runs without the vendor's servers.

.DESCRIPTION
  Extracts the JS bundle from your own copy of the v1.40 APK, patches it (patch-bundle.js),
  swaps it back in without the old signature (repack.py), then zipaligns and signs it with
  your own key. Needs node, python 3, zipalign, apksigner and keytool (found on PATH, or
  zipalign/apksigner under ANDROID_HOME / ANDROID_SDK_ROOT build-tools, keytool under JAVA_HOME).

.PARAMETER Apk
  Path to the original Pix Backpack v1.40 APK (not included in this repository).

.PARAMETER Out
  Output APK path. Default: out\PixBackpack-1.40-revived.apk next to this script.

.PARAMETER Keystore
  Signing keystore. Created if it does not exist. Default: keys\pix-local.jks next to this script.
  Keep it: later rebuilds must be signed with the same key to install as an update.

.PARAMETER KeyAlias
  Key alias inside the keystore. Default: pix.

.PARAMETER KeystorePassword
  Keystore/key password (at least 6 characters). If omitted, the PIX_KS_PASS environment
  variable is used, otherwise you are prompted.

.EXAMPLE
  .\build-a.ps1 -Apk .\PixBackpack-1.40.apk
#>
param(
  [Parameter(Mandatory = $true)][string]$Apk,
  [string]$Out = (Join-Path $PSScriptRoot 'out\PixBackpack-1.40-revived.apk'),
  [string]$Keystore = (Join-Path $PSScriptRoot 'keys\pix-local.jks'),
  [string]$KeyAlias = 'pix',
  [string]$KeystorePassword
)
$ErrorActionPreference = 'Stop'

function Find-Tool([string[]]$names, [string[]]$extraDirs) {
  foreach ($n in $names) {
    $c = Get-Command $n -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.Source }
  }
  foreach ($d in $extraDirs) {
    if (-not $d -or -not (Test-Path -LiteralPath $d)) { continue }
    foreach ($n in $names) {
      foreach ($ext in '', '.exe', '.bat', '.cmd') {
        $p = Join-Path $d ($n + $ext)
        if (Test-Path -LiteralPath $p -PathType Leaf) { return $p }
      }
    }
  }
  return $null
}

function Require([string]$path, [string]$what, [string]$hint) {
  if (-not $path) { throw "$what not found. $hint" }
  return $path
}

# Android SDK build-tools dirs, newest first.
$buildTools = @()
foreach ($sdk in $env:ANDROID_HOME, $env:ANDROID_SDK_ROOT) {
  if ($sdk -and (Test-Path -LiteralPath (Join-Path $sdk 'build-tools'))) {
    $buildTools += Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Directory |
      Sort-Object { try { [version]$_.Name } catch { [version]'0.0' } } -Descending |
      ForEach-Object { $_.FullName }
  }
}
$javaBin = @()
if ($env:JAVA_HOME) { $javaBin += (Join-Path $env:JAVA_HOME 'bin') }

$node      = Require (Find-Tool @('node') @()) 'node' 'Install Node.js 18+ and put it on PATH.'
$python    = Require (Find-Tool @('python', 'python3', 'py') @()) 'python' 'Install Python 3 and put it on PATH.'
$zipalign  = Require (Find-Tool @('zipalign') $buildTools) 'zipalign' 'Install Android SDK build-tools and set ANDROID_HOME (or put build-tools on PATH).'
$apksigner = Require (Find-Tool @('apksigner') $buildTools) 'apksigner' 'Install Android SDK build-tools and set ANDROID_HOME (or put build-tools on PATH).'
$keytool   = Require (Find-Tool @('keytool') $javaBin) 'keytool' 'Install a JDK (17+) and set JAVA_HOME or put its bin folder on PATH.'

if (-not (Test-Path -LiteralPath $Apk)) { throw "APK not found: $Apk" }
$Apk = (Resolve-Path -LiteralPath $Apk).Path

if (-not $KeystorePassword) { $KeystorePassword = $env:PIX_KS_PASS }
if (-not $KeystorePassword) {
  $sec = Read-Host -AsSecureString 'Keystore password (min 6 chars)'
  $KeystorePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}
if ($KeystorePassword.Length -lt 6) { throw 'Keystore password must be at least 6 characters.' }

$work = Join-Path $PSScriptRoot 'work'
foreach ($d in $work, (Split-Path -Parent $Out), (Split-Path -Parent $Keystore)) {
  if ($d) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}
$origBundle = Join-Path $work 'orig.android.bundle'
$newBundle  = Join-Path $work 'index.android.bundle'
$unsigned   = Join-Path $work 'unsigned.apk'
$aligned    = Join-Path $work 'aligned.apk'

Write-Host '[1/5] Extracting JS bundle'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($Apk)
try {
  $entry = $zip.GetEntry('assets/index.android.bundle')
  if (-not $entry) { throw 'assets/index.android.bundle not found in the APK. Is this the original Pix Backpack v1.40 APK?' }
  [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $origBundle, $true)
} finally { $zip.Dispose() }

Write-Host '[2/5] Patching bundle'
& $node (Join-Path $PSScriptRoot 'patch-bundle.js') $origBundle $newBundle
if ($LASTEXITCODE) { throw 'patch-bundle.js failed (wrong app version?).' }

Write-Host '[3/5] Repacking APK'
& $python -I (Join-Path $PSScriptRoot 'repack.py') $Apk $newBundle $unsigned
if ($LASTEXITCODE) { throw 'repack.py failed.' }

Write-Host '[4/5] Aligning'
& $zipalign -p -f 4 $unsigned $aligned
if ($LASTEXITCODE) { throw 'zipalign failed.' }

Write-Host '[5/5] Signing'
# Passwords go through an environment variable, not the command line.
$env:PIX_KS_PASS_INTERNAL = $KeystorePassword
try {
  if (-not (Test-Path -LiteralPath $Keystore)) {
    Write-Host "Creating keystore $Keystore"
    & $keytool -genkeypair -keystore $Keystore '-storepass:env' PIX_KS_PASS_INTERNAL '-keypass:env' PIX_KS_PASS_INTERNAL `
      -alias $KeyAlias -keyalg RSA -keysize 2048 -validity 20000 -dname 'CN=Pix Local'
    if ($LASTEXITCODE) { throw 'keytool failed.' }
  }
  & $apksigner sign --ks $Keystore --ks-pass env:PIX_KS_PASS_INTERNAL --key-pass env:PIX_KS_PASS_INTERNAL `
    --ks-key-alias $KeyAlias --out $Out $aligned
  if ($LASTEXITCODE) { throw 'apksigner sign failed.' }
  & $apksigner verify $Out
  if ($LASTEXITCODE) { throw 'apksigner verify failed.' }
} finally {
  Remove-Item Env:\PIX_KS_PASS_INTERNAL -ErrorAction SilentlyContinue
}

Write-Host "Built $Out"
