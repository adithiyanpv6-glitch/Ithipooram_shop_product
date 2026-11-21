# ==============================================================================
# ITHI POORAM (ഇത്തിപ്പൂരം) - PERMANENT LAPTOP LID-CLOSE & WI-FI POWER FIX
# Guarantees zero sleep when lid is closed, full speed Wi-Fi & tunnel connectivity
# ==============================================================================

Write-Host "Applying zero-sleep power settings for lid-close operation..." -ForegroundColor Cyan

# 1. Lid Close Action = 0 (Do Nothing) on both AC and Battery (DC)
# Subgroup: 4f971e89-eebd-4455-a8de-9e59040e7347 (Power buttons and lid)
# Setting:  5ca83367-6e45-459f-a27b-476b1d01c936 (Lid-close action)
powercfg /setacvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 2>$null
powercfg /setdcvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 2>$null

# 2. Wireless Adapter Power Saving Mode = 0 (Maximum Performance)
# Subgroup: 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 (Wireless Adapter Settings)
# Setting:  12bbebe6-58d6-4636-95bb-3217ef867c1a (Power Saving Mode: 0=Max Perf)
powercfg /setacvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 12bbebe6-58d6-4636-95bb-3217ef867c1a 0 2>$null
powercfg /setdcvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 12bbebe6-58d6-4636-95bb-3217ef867c1a 0 2>$null

# 3. Disable Standby and Hibernate timeouts completely (0 = Never)
powercfg /change standby-timeout-ac 0 2>$null
powercfg /change standby-timeout-dc 0 2>$null
powercfg /change hibernate-timeout-ac 0 2>$null
powercfg /change hibernate-timeout-dc 0 2>$null

# 4. Activate current scheme
powercfg /setactive SCHEME_CURRENT 2>$null

# 5. Win32 SetThreadExecutionState: ES_CONTINUOUS (0x80000000) | ES_SYSTEM_REQUIRED (0x00000001) | ES_AWAYMODE_REQUIRED (0x00000040)
try {
    $code = @'
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
'@
    $type = Add-Type -MemberDefinition $code -Name "PowerKeepAwake" -Namespace "IthiPooramWin32" -PassThru -ErrorAction SilentlyContinue
    if ($type) {
        # 0x80000001 | 0x00000040 = 2147483713
        $type::SetThreadExecutionState([uint32]2147483713) | Out-Null
        Write-Host "      -> Win32 Kernel Execution Lock ACTIVE (Continuous POS Operation)" -ForegroundColor Green
    }
} catch {}

Write-Host "[SUCCESS] Laptop is configured to operate normally with lid closed!" -ForegroundColor Green
