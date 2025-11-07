# Testing Guide - X1 Keyring Fix (v0.10.37)

## Overview
This guide provides step-by-step instructions for testing the X1 blockchain keyring fix in Backpack wallet extension v0.10.37.

## Prerequisites
- Chrome or Chrome-based browser (Brave, Edge, etc.)
- X1 wallet with seed phrase
- Some XNT tokens for testing transactions
- Test recipient address on X1

## Installation Steps

### 1. Load the Extension in Chrome

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions`
   - Or click the puzzle icon → "Manage Extensions"

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Remove Old Backpack Extension** (if installed)
   - Find the existing Backpack extension
   - Click "Remove"
   - Confirm removal

4. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Navigate to `~/Desktop/backpack-extension`
   - Click "Select"

5. **Verify Version**
   - The extension should show version **0.10.37**
   - You should see the Backpack logo

6. **Pin Extension** (Optional)
   - Click the puzzle icon in Chrome toolbar
   - Find "Backpack"
   - Click the pin icon to keep it visible

### 2. Set Up Wallet

1. **Import Your Wallet**
   - Click the Backpack extension icon
   - Select "Import wallet"
   - Enter your seed phrase
   - Create a password

2. **Enable X1 Blockchain**
   - Click the hamburger menu (☰)
   - Go to "Settings"
   - Select "Blockchains"
   - Toggle ON "X1"
   - Click "Save"

3. **Verify X1 Wallet**
   - In the main view, click the blockchain selector (top of screen)
   - Select "X1"
   - Verify your X1 address is shown
   - Confirm your XNT balance is displayed

## Testing Scenarios

### Test 1: View Console Logs (Setup)

Before testing transactions, set up console logging to monitor blockchain parameters:

1. **Open Extension Console**
   - Right-click the Backpack extension icon
   - Select "Inspect popup" or "Inspect"
   - Click on the "Console" tab

2. **Open Service Worker Console**
   - Go to `chrome://extensions`
   - Find Backpack extension
   - Click "service worker" link (under "Inspect views")
   - A new DevTools window opens - this is where logs will appear

**Keep this console window open during all tests!**

### Test 2: Send XNT Transaction (PRIMARY TEST)

This is the main test that reproduces the original bug.

**Steps:**

1. **Prepare Test**
   - Make sure you're on X1 blockchain
   - Have at least 0.01 XNT for test + gas
   - Have a recipient address ready

2. **Initiate Send**
   - Click "Send" button
   - Select XNT token
   - Enter recipient address
   - Enter amount (e.g., 0.001 XNT)
   - Click "Review"

3. **Check Console Logs**
   - Switch to the Service Worker console
   - Look for: `[SECURE_SVM_SIGN_TX] blockchain: x1`
   - **Expected**: Should see "x1" (not "solana")

4. **Confirm Transaction**
   - Review transaction details
   - Click "Send"
   - Enter password if prompted

5. **Verify Success**
   - ✅ **SUCCESS**: Transaction should complete without errors
   - ✅ **SUCCESS**: No "no keyring for solana" error
   - ✅ **SUCCESS**: Transaction hash displayed
   - ✅ **SUCCESS**: Balance updates after confirmation

**Expected Console Output:**
```
[SECURE_SVM_SIGN_TX] blockchain: x1
```

**❌ FAILURE Indicators:**
- Error: "no keyring for solana"
- Console shows: `[SECURE_SVM_SIGN_TX] blockchain: solana`
- Transaction fails to sign

### Test 3: Sign Message on X1

Tests the `signMessage` handler fix.

**Prerequisites:**
- A dApp that supports Solana/X1 message signing
- Or use developer console to trigger message signing

**Steps:**

1. **Trigger Message Signing**
   - Connect to a dApp on X1
   - Request message signature
   - Or run in console:
   ```javascript
   window.backpack.signMessage(new TextEncoder().encode("Test message"), "base58");
   ```

2. **Check Console**
   - Look for: `[SECURE_SVM_SIGN_MESSAGE] blockchain: x1`

3. **Sign Message**
   - Review message
   - Click "Sign"

4. **Verify Success**
   - ✅ Message signed successfully
   - ✅ Signature returned
   - ✅ No keyring errors

### Test 4: Sign Multiple Transactions

Tests the `signAllTransactions` handler fix.

**Prerequisites:**
- A dApp that batches multiple transactions
- Or create multiple transactions programmatically

**Steps:**

1. **Trigger Batch Signing**
   - Use a dApp that sends multiple transactions
   - Or programmatically create batch

2. **Check Console**
   - Look for: `[SECURE_SVM_SIGN_ALL_TX] blockchain: x1`

3. **Sign All Transactions**
   - Review transactions
   - Click "Sign All"

4. **Verify Success**
   - ✅ All transactions signed
   - ✅ No keyring errors

### Test 5: Solana Compatibility Check

Ensures the fix doesn't break existing Solana functionality.

**Steps:**

1. **Switch to Solana**
   - Click blockchain selector
   - Select "Solana"

2. **Send SOL Transaction**
   - Click "Send"
   - Select SOL token
   - Enter recipient and amount
   - Click "Review"

3. **Check Console**
   - Look for: `[SECURE_SVM_SIGN_TX] blockchain: solana`
   - **Expected**: Should see "solana" (the fallback)

4. **Complete Transaction**
   - Click "Send"
   - Verify success

5. **Verify Success**
   - ✅ Transaction completes normally
   - ✅ Solana transactions still work
   - ✅ No regression

## Console Log Reference

### What to Look For

The fix adds console logging to three handlers:

| Handler | Log Pattern | When It Appears |
|---------|-------------|-----------------|
| handleSign | `[SECURE_SVM_SIGN_TX] blockchain: <value>` | When signing a transaction |
| handleSignMessage | `[SECURE_SVM_SIGN_MESSAGE] blockchain: <value>` | When signing a message |
| handleSignAll | `[SECURE_SVM_SIGN_ALL_TX] blockchain: <value>` | When signing multiple transactions |

### Expected Values

| Blockchain | Expected Log Value |
|------------|-------------------|
| X1 | `blockchain: x1` |
| Solana | `blockchain: solana` |

### Example Console Output

**✅ CORRECT (X1 Transaction):**
```
[SECURE_SVM_SIGN_TX] blockchain: x1
```

**❌ INCORRECT (Bug Still Present):**
```
[SECURE_SVM_SIGN_TX] blockchain: solana
```

**✅ CORRECT (Solana Transaction):**
```
[SECURE_SVM_SIGN_TX] blockchain: solana
```

## Troubleshooting

### Problem: No Console Logs Appearing

**Solution:**
1. Make sure you're looking at the **Service Worker** console, not the Popup console
2. Go to `chrome://extensions` → Backpack → click "service worker"
3. The console logs appear in the Service Worker DevTools

### Problem: Still Getting "no keyring for solana" Error

**Possible Causes:**
1. **Wrong version loaded**: Verify version is 0.10.37
2. **Cache issue**: Try:
   - Remove extension completely
   - Close all Chrome windows
   - Reopen Chrome
   - Load extension again
3. **Build issue**: Verify build completed successfully
4. **Console shows wrong blockchain**: If logs show "solana" instead of "x1", the fix didn't apply

**Debug Steps:**
1. Check console log - what blockchain value is shown?
2. Verify you're on X1 blockchain in the UI
3. Check manifest.json version in extension folder
4. Try hard reload: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Problem: Extension Won't Load

**Solution:**
1. Check `manifest.json` exists in `~/Desktop/backpack-extension`
2. Verify all files copied correctly
3. Check browser console for load errors
4. Try using absolute path when loading

### Problem: Transaction Fails for Other Reasons

**Not related to keyring fix if:**
- Error is about insufficient balance
- Error is about network issues
- Error is about invalid recipient address

**Related to keyring fix if:**
- Error mentions "no keyring"
- Error mentions "solana" when using X1
- Console shows wrong blockchain value

## Success Criteria

The fix is working correctly if ALL of the following are true:

- ✅ Extension loads successfully (version 0.10.37)
- ✅ X1 blockchain appears in blockchain selector
- ✅ XNT balance displays correctly
- ✅ Console log shows `blockchain: x1` when sending XNT
- ✅ **Transaction signs WITHOUT "no keyring for solana" error**
- ✅ Transaction completes successfully
- ✅ Transaction hash is displayed
- ✅ Balance updates after transaction
- ✅ Solana transactions still work (no regression)

## Test Results Template

Copy this template to document your test results:

```markdown
## Test Results - X1 Keyring Fix v0.10.37

**Date:** [DATE]
**Tester:** [NAME]
**Browser:** [Chrome/Brave/Edge + version]

### Test 1: View Console Logs
- [ ] Service Worker console opened
- [ ] Console logs visible

### Test 2: Send XNT Transaction
- [ ] Transaction initiated
- [ ] Console shows: `[SECURE_SVM_SIGN_TX] blockchain: x1`
- [ ] No "no keyring for solana" error
- [ ] Transaction signed successfully
- [ ] Transaction confirmed on blockchain
- [ ] Balance updated

**Transaction Hash:** [HASH]

### Test 3: Sign Message
- [ ] Message signing triggered
- [ ] Console shows: `[SECURE_SVM_SIGN_MESSAGE] blockchain: x1`
- [ ] Message signed successfully

### Test 4: Solana Compatibility
- [ ] Switched to Solana blockchain
- [ ] SOL transaction initiated
- [ ] Console shows: `[SECURE_SVM_SIGN_TX] blockchain: solana`
- [ ] Transaction completed successfully

### Issues Encountered
[Describe any issues]

### Overall Result
- [ ] PASS - All tests successful
- [ ] FAIL - Issues found (describe above)
```

## Next Steps After Testing

### If Tests Pass
1. Document successful test results
2. Remove console.log statements (optional for production)
3. Consider deploying to production
4. Monitor for any user reports

### If Tests Fail
1. Document exact error messages
2. Capture console output
3. Check which test failed
4. Review the relevant handler code
5. Report findings with:
   - Test that failed
   - Console output
   - Error message
   - Steps to reproduce

## Additional Notes

- Console logs are for debugging only and can be removed in production
- The `?? Blockchain.SOLANA` fallback ensures backwards compatibility
- All three handlers (sign, signMessage, signAll) were updated for completeness
- X1 uses the same signing mechanism as Solana (SVM-compatible)

## Support

If you encounter issues:
1. Check the console logs first
2. Verify version 0.10.37 is loaded
3. Review troubleshooting section above
4. Check `X1_KEYRING_FIX_SUMMARY.md` for technical details

---

**Version:** 0.10.37
**Build Location:** ~/Desktop/backpack-extension
**Documentation:** X1_KEYRING_FIX_SUMMARY.md
