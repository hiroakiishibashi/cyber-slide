# Cyber Slide — Update History

申請完了が確認されたバージョンのみ記録。

---

## ✅ v23 — 2026-04-02

**Status: 申請済み（Playgama ✅ / CrazyGames ✅ / itch.io ✅）**

### New Features

**Rewarded Ad Support (Playgama / CrazyGames)**
- On game over, players can watch a rewarded ad to receive +10 turns and continue playing
- Rewarded prompt shown BEFORE block destruction — board stays intact on reward
- Unlimited rewarded ad use per session (SDK enforces cooldown natively)
- Reward granted only on completion; closed/failed proceeds to normal game over
- Interstitial ad shown as fallback when rewarded ad is unavailable

**CrazyGames SDK v3 Integration**
- Full SDK integration: loadingStart/Stop, gameplayStart/Stop, rewarded & interstitial ads
- Adblocker detection via Promise API
- muteAudio settings change listener

**First-Play Tutorial**
- In-game tutorial overlay shown on every page load (session-based)
- Arrow key icons and drag gesture hint with animations
- Automatically dismisses on first tilt input
- Responsive layout for portrait mobile (max-width 520px)

**Title Screen Enhancements**
- Pulsing glow animation and slide-in entrance effect
- Subtitle "SLIDE · MATCH · CLEAR" with fade-in animation
- Staggered entrance animations for menu buttons

### Platform Support
| Platform | SDK | Ads | Save |
|----------|-----|-----|------|
| Playgama | Playgama Bridge | Interstitial + Rewarded | Bridge Storage → localStorage |
| CrazyGames | CrazyGames SDK v3 | Midgame + Rewarded | localStorage |
| itch.io | なし | なし | localStorage |

### Bug Fixes
- Fixed invisible ghost blocks after rewarded ad resume
- Fixed game freeze when Playgama rewarded ad closed mid-play (closed state now triggers game-over flow)
- Fixed version display string (v22 → v23)
- Fixed CrazyGames SDK method names (sdkGameLoadingStart/Stop → loadingStart/Stop)
- Fixed hasAdblock() callback → Promise API

---

*申請完了を教えていただければ、このファイルのステータスを更新します。*
