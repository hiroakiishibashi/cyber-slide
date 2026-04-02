# Cyber Slide — Update History

申請完了が確認されたバージョンのみ記録。

---

<!-- 申請完了後にエントリを追加する -->
<!-- 例: [申請中] → [✅ 申請済み YYYY-MM-DD] -->

## [Pending] v23 — 2026-04-02

**Status: 申請中（申請完了後に確定）**

### New Features

**Rewarded Ad Support**
- Added rewarded ad integration via Playgama Bridge SDK
- On game over, players can watch a rewarded ad to receive +10 turns and continue playing
- Rewarded button is shown only when `isRewardedSupported` is true and limited to once per stage
- Reward is granted only on `rewarded` state (not on `closed` or `failed`)
- Interstitial ad is shown as fallback when rewarded ad is unavailable

**First-Play Tutorial**
- Added an in-game tutorial overlay for first-time players
- Displays arrow key icons and drag gesture hint with animations
- Automatically dismisses on the player's first tilt input
- Shown only once, stored via localStorage

**Title Screen Enhancements**
- Added pulsing glow animation and slide-in entrance effect to the title
- Added subtitle "SLIDE · MATCH · CLEAR" with fade-in animation
- Added staggered entrance animations for menu buttons

### Improvements
- Improved overall first impression to reduce bounce rate
- Tutorial overlay uses full-screen backdrop for better visibility on all devices

---

*申請完了を教えていただければ、このファイルのステータスを更新します。*
