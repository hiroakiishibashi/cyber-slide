# Cyber Slide — Update History

申請完了が確認されたバージョンのみ記録。

---

## ✅ v27.9b — 2026-04-15

**Status: Submitted (Playgama ✅)**

### Changes (v27.8 → v27.9b)

**BGM Test Menu**
- SETTINGS button (ss-btn-title-settings) now opens debug/config menu in 1 click
- BGM TEST section added to config menu: AMBIENT / EDM / RETRO BIT / ■ STOP buttons
- Active track highlighted in cyan with status label

**In-Game BGM**
- Title screen & stage select: AMBIENT BGM plays automatically
- Gameplay: EDM BGM plays automatically (startBGM → playBgmTest('edm'))
- All transitions properly stop/restart BGM via stopBGM() → stopBgmTest()
- SOUND OFF toggle mutes BGM via masterGain

**Debug: Reset Save Data**
- RESET SAVE DATA button added to config/SETTINGS menu
- 2-click confirm (⚠ TAP AGAIN TO CONFIRM → executes after 2nd tap, auto-cancels after 3s)
- itch.io / CrazyGames: clears all localStorage keys (save, unlocked, cores, per-stage cleared/best, first-run flags)
- Playgama: also resets bridge.storage server-side (SAVE_KEY→'1', UNLOCKED_V2_KEY→'[1]', CORES_KEY→'0')
- Resets in-memory state (maxUnlockedStage=1, unlockedStagesSet={1}, totalCores=0)

**BACK button fix**
- Config menu BACK now returns to stage select title screen (3D starfield) instead of plain main-menu

**Version**
- Display updated: v27.3 → v27.9

---

## ✅ v27.8 — 2026-04-15

**Status: Submitted (Playgama ✅)**

### Changes (v27.4 → v27.8)

**HUD Readability**
- Added `text-shadow` to `.hud-label` / `.hud-val` / `.ss-bgm-toggle` — white text now readable against 3D background without glass-panel backdrop

**Audio — Mobile Fix & BGM Removal**
- `startBGM()` made async with `audioCtx.resume()` — fixed mobile AudioContext 'suspended' bug
- `toggleSound()` now restarts BGM on unmute if `bgmInterval` is null
- `stopBGM()` now nulls `bgmInterval` so mute/unmute state is tracked correctly
- **v27.8: All BGM removed** (`startBGM` / `stopBGM` stubbed to no-ops; all instrument functions deleted)
- Stage-select ambient drones, bell, delay chain, and sequencer also removed
- SE functions (block pop, core collect, jingle, etc.) and `speak()` voice are retained

**UI Fixes**
- REBOOT button: switched from `ss-bgm-toggle` → `btn-base` (fixes label-bleed bug where SOUND toggle changed REBOOT text)
- SOUND toggle label inverted: shows action ("SOUND OFF" = currently on, "SOUND ON" = currently muted)
- REBOOT button style: dark background + subtle border/text for unobtrusive appearance
- NEXT WAVE preview reduced from 10 → 5 future blocks

**Mobile Browser Chrome**
- `viewport-fit=cover` added to viewport meta
- `theme-color: #060003` (dark warm red) — status bar matches game tone instead of blue-purple
- `apple-mobile-web-app-capable` + `black-translucent` status bar style for iOS Safari
- `body` background changed from `#050510` → `#060003`

---

## ✅ v27.3 — 2026-04-09

**Status: Submitted (CrazyGames ✅ / Playgama ✅)**

### New Features

**CORE Economy & Stage Clear Rewards**
- Unlock dialog skipped when CORE balance is sufficient — unlocks instantly
- Remaining CORE blocks on the board are collected on stage clear (counted as earned CORE)
- First-clear bonus: +1 CORE per stage (tracked via `cs_stage_cleared_N` key, independent of score)
- Score bonus: +1 CORE per 1,000 points earned
- Stage clear overlay shows animated CORE breakdown: EARNED CORE / SCORE BONUS / FIRST CLEAR / TOTAL CORE (count-up animation)

**First-Run Auto-Start**
- First-time players are automatically taken from title → Stage 1 without spending CORE
- Camera zooms to Stage 1, 1.5s pause, then auto-launches — removes new-user friction
- Tracked via `cs_first_run_v1` localStorage key; never repeats

**BGM/SE Toggle**
- Single shared toggle button (top-right, always visible on title and stage select)
- Default: ON (button label shows "OFF" to indicate click action)
- Controls both BGM and SE simultaneously; synced between game and stage select audio systems

**Board Centering & Tilt Pivot**
- Board position computed from tile centroid (not bounding box) — asymmetric shapes (L, T, cross, etc.) are truly centered on screen
- Tilt rotation pivots around the centroid, making all shapes feel balanced
- Camera zoom recalculated from actual tile extents for tight framing

**Stage Design Overhaul**
- 24 unique board shapes (up from 18), always rendered on full 8×8 canvas
- Tile budget (maxTiles) controls complexity per stage — early stages start small, shapes emerge fully by mid-game
- Consecutive stages always use a different shape type
- `initialFill` parameter per stage: fraction of valid tiles pre-filled at stage start (0.30–0.45); prevents board-full on spawn at stage start or restart

**Stage Editor — Test Play**
- "Test Play" button now launches directly into the game, skipping title screen and stage select entirely
- `ss-overlay` is fully hidden (`display:none; pointer-events:none`) during editor test sessions to prevent invisible click interception

### Stage Data (stages.json)
- Stages 1–25: hand-crafted maps (shapes designed and edited via Stage Editor)
- Stages 26–300: 55-pattern MAP_LIBRARY cycled with difficulty scaling
- All 300 stages verified: zero isolated cells (cells with 0 neighbors where blocks get permanently stuck)
- `initialFill` field added to all stage records
- `cs_stage_cleared_N` key used for first-clear detection (replaces score-based `_pb === 0` check)

### Banner Text Fixes
- "TIME UP!" → "TURN BONUS" (combo turn reward)
- "TIME EXTEND" → "TURN EXTEND" (obstacle break reward)
- "TIME BONUS" → "SCORE BONUS" (stage clear turn-to-score conversion)
- Fixed `showStageBanner(0, ...)` calls that incorrectly showed "STAGE 0"

### Stage Generator (generate_stages.js v6)
- Stages 1–25 embedded as hand-crafted data; preserved across regeneration
- Stages 26–300 use MAP_LIBRARY (55 patterns: plus/ring, brackets, spirals, zigzags, S-curves, nested-Ls, hourglass, pinstripe-cross, etc.)
- `initialFill` included in all generated stage records
- Clearability guaranteed: `turnLimit = ceil(targetCores × spawnRate / spawnAmount × 2.5)`

---

## 🚧 v25 — 2026-04-05

**Status: 開発完了・申請準備中**

### New Features

**3D Stage Select (StageSelect統合)**
- 300個のステージノードを球体上に螺旋配置した3D宇宙マップをindex.htmlに統合
- Three.js + Bloom後処理によるサイバーパンク演出（選択中ノードのパーティクル・流れ星）
- ステージクリア後に自動的に3Dマップへ戻り、次ステージアンロック演出
- ゲームオーバー後のEXITボタンで3Dマップへ戻る
- BACKボタンでタイトル画面に戻る機能
- 選択中ステージのハイライト色が動的に変化
- アンビエントBGM（ドローン音・ランダムベル）

**Leaderboard Integration**
- Playgama: `bridge.leaderboards.getEntries('highscore')` でプレイヤー周辺5名を表示
- CrazyGames / itch.io: localStorage `cs_stage_best_N` から個人ベストを表示
- ステージクリア時に個人ベストをlocalStorageに保存
- Playgamaでスコアをリーダーボードに送信（`setScore`）

### Bug Fixes
- バージョン表示を v24 → v25 に更新

---

## ✅ v24 — 2026-04-03

**Status: 申請済み（Playgama ✅）**

### Playgama SDK Enhancements
- `preloadRewarded()` をSDK初期化直後に実行 → リワード広告の待ち時間ゼロ
- `visibility_state_changed` リスナー追加 → タブ非表示時に音声ミュート・TTS停止、復帰時に自動復元
- `gameplay_started/stopped` メッセージ送信 → Playgamaアナリティクスの精度向上
- `trySocialPrompt()`: ステージ5クリアで `rate()`、ステージ10クリアで `addToHomeScreen()` を各1回表示
- config: `minimumDelayBetweenInterstitial` 60→30秒、`rewarded.preloadOnStart: true` 追加

### Bug Fixes
- バージョン表示を v23 → v24 に更新

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
- Fixed game freeze when Playgama rewarded ad closed mid-play
- Fixed CrazyGames SDK method names (sdkGameLoadingStart/Stop → loadingStart/Stop)
- Fixed hasAdblock() callback → Promise API

---

*申請完了を教えていただければ、このファイルのステータスを更新します。*
