# Автомагнитола — 3D-плеер: план реализации (фаза 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать локально работающий веб-плеер, где управление — это физическая
автомагнитола в 3D-салоне машины, на которую смотришь от первого лица.

**Architecture:** Three.js через CDN (ES-модули, importmap), без сборщика.
Радио и рука — настоящая 3D-геометрия из примитивов; салон — панорамная текстура
на внутренней стороне сферы. Модули в `src/` связаны только через явные колбэки:
`player.js` не знает про 3D, `interaction.js` не знает про аудио, `radio.js`
отдаёт наружу именованные меши органов управления.

**Tech Stack:** Three.js r168 (CDN unpkg/jsdelivr), vanilla ES-modules, HTML5
Audio, Canvas 2D для LCD и процедурных текстур, `node --test` для юнит-тестов,
`python3 -m http.server` как локальный статик-сервер.

## Global Constraints

- Только десктоп с мышью. Тач-управление и мобильная вёрстка — вне фазы 1.
- Без сборщика, без npm-зависимостей в рантайме: Three.js только через CDN.
- Плейлист захардкожен в `src/tracks.js`; у каждого трека есть поле `mood`, но в
  фазе 1 оно ни на что не влияет — у всех шести треков значение `neutral`.
- Кнопки AM, FM, EJECT и щель кассеты — декоративные: нажимаются и подсвечиваются,
  действия нет.
- Маппинг органов управления (сознательно не как у реальной магнитолы):
  `SEEK◀`/`SEEK▶` — предыдущий/следующий трек, TUNE (правая крутилка) — громкость,
  VOL (левая крутилка) — play/pause.
- Тестами покрывается только чистая логика без DOM, WebGL и audio API.
- Камера — поворот головы из фиксированной точки глаз водителя, не орбита.
  Пределы: yaw ±100°, pitch ±45°.
- Порог отделения клика от drag — 5 px.

---

## Файловая структура

| Файл | Ответственность |
|---|---|
| `index.html` | canvas, стартовый оверлей, importmap для Three.js |
| `styles/style.css` | оверлей, курсоры, подсказки, сообщение об отсутствии WebGL |
| `src/tracks.js` | данные шести треков: title, artist, url, mood |
| `src/playlist.js` | чистая логика перехода по индексу трека по кругу |
| `src/player.js` | HTML5 Audio: play/pause, next/prev, громкость, ended, ошибки |
| `src/knob.js` | чистая логика: угол крутилки → громкость 0..1 с клампингом |
| `src/marquee.js` | чистая логика бегущей строки для длинных названий |
| `src/cameraMath.js` | чистая логика: клампинг yaw/pitch/zoom |
| `src/camera.js` | first-person камера: инерция, drag, колесо, применение clamp |
| `src/textures.js` | загрузка сгенерированных текстур + процедурные фолбэки |
| `src/lcd.js` | живая CanvasTexture дисплея |
| `src/radio.js` | 3D-модель радио и именованные меши органов управления |
| `src/hand.js` | низкополигональная рука и анимации нажатия/захвата |
| `src/scene.js` | рендерер, свет, панорамная сфера салона |
| `src/interaction.js` | raycasting: hover, клик, drag крутилок |
| `src/main.js` | точка входа: сборка сцены, связывание контролов с плеером |
| `tests/*.test.js` | юнит-тесты чистой логики |

---

### Task 1: Чистая логика — плейлист, крутилка, камера, бегущая строка

**Files:**
- Create: `src/playlist.js`, `src/knob.js`, `src/cameraMath.js`, `src/marquee.js`
- Test: `tests/playlist.test.js`, `tests/knob.test.js`, `tests/cameraMath.test.js`, `tests/marquee.test.js`

**Interfaces:**
- Produces:
  - `nextIndex(current: number, length: number): number`
  - `prevIndex(current: number, length: number): number`
  - `angleToVolume(angleRad: number, minAngle: number, maxAngle: number): number`
  - `volumeToAngle(volume: number, minAngle: number, maxAngle: number): number`
  - `clampYaw(yaw: number): number`, `clampPitch(pitch: number): number`,
    `clampZoom(z: number): number`
  - `marqueeOffset(textWidth: number, viewWidth: number, timeMs: number, speedPxPerSec: number, pauseMs: number): number`

- [ ] **Step 1: Написать падающие тесты**

```js
// tests/playlist.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, prevIndex } from '../src/playlist.js';

test('next wraps around the end', () => {
  assert.equal(nextIndex(0, 6), 1);
  assert.equal(nextIndex(5, 6), 0);
});

test('prev wraps around the start', () => {
  assert.equal(prevIndex(5, 6), 4);
  assert.equal(prevIndex(0, 6), 5);
});
```

```js
// tests/knob.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleToVolume, volumeToAngle } from '../src/knob.js';

const MIN = -2.2, MAX = 2.2;

test('angle maps linearly to volume', () => {
  assert.equal(angleToVolume(MIN, MIN, MAX), 0);
  assert.equal(angleToVolume(MAX, MIN, MAX), 1);
  assert.equal(angleToVolume(0, MIN, MAX), 0.5);
});

test('angle outside the range is clamped', () => {
  assert.equal(angleToVolume(MIN - 5, MIN, MAX), 0);
  assert.equal(angleToVolume(MAX + 5, MIN, MAX), 1);
});

test('volumeToAngle is the inverse of angleToVolume', () => {
  assert.ok(Math.abs(angleToVolume(volumeToAngle(0.3, MIN, MAX), MIN, MAX) - 0.3) < 1e-9);
});
```

```js
// tests/cameraMath.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampYaw, clampPitch, clampZoom, YAW_LIMIT, PITCH_LIMIT, ZOOM_MIN, ZOOM_MAX } from '../src/cameraMath.js';

test('yaw is clamped to +-100 degrees', () => {
  assert.equal(clampYaw(0), 0);
  assert.equal(clampYaw(10), YAW_LIMIT);
  assert.equal(clampYaw(-10), -YAW_LIMIT);
});

test('pitch is clamped to +-45 degrees', () => {
  assert.equal(clampPitch(10), PITCH_LIMIT);
  assert.equal(clampPitch(-10), -PITCH_LIMIT);
});

test('zoom is clamped to the configured range', () => {
  assert.equal(clampZoom(0), ZOOM_MIN);
  assert.equal(clampZoom(100), ZOOM_MAX);
});
```

```js
// tests/marquee.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marqueeOffset } from '../src/marquee.js';

test('text that fits is never shifted', () => {
  assert.equal(marqueeOffset(100, 200, 5000, 40, 1000), 0);
});

test('long text stays still during the initial pause', () => {
  assert.equal(marqueeOffset(400, 200, 500, 40, 1000), 0);
});

test('long text scrolls after the pause', () => {
  assert.equal(marqueeOffset(400, 200, 2000, 40, 1000), 40);
});

test('scrolling never exceeds the overflow width', () => {
  assert.equal(marqueeOffset(400, 200, 999999, 40, 1000), 200);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../src/playlist.js'` и т.д.

- [ ] **Step 3: Реализовать модули**

```js
// src/playlist.js
export function nextIndex(current, length) {
  return (current + 1) % length;
}

export function prevIndex(current, length) {
  return (current - 1 + length) % length;
}
```

```js
// src/knob.js
export function angleToVolume(angle, minAngle, maxAngle) {
  const t = (angle - minAngle) / (maxAngle - minAngle);
  return Math.min(1, Math.max(0, t));
}

export function volumeToAngle(volume, minAngle, maxAngle) {
  const v = Math.min(1, Math.max(0, volume));
  return minAngle + v * (maxAngle - minAngle);
}
```

```js
// src/cameraMath.js
export const YAW_LIMIT = (100 * Math.PI) / 180;
export const PITCH_LIMIT = (45 * Math.PI) / 180;
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.6;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const clampYaw = (yaw) => clamp(yaw, -YAW_LIMIT, YAW_LIMIT);
export const clampPitch = (pitch) => clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
export const clampZoom = (z) => clamp(z, ZOOM_MIN, ZOOM_MAX);
```

```js
// src/marquee.js
export function marqueeOffset(textWidth, viewWidth, timeMs, speedPxPerSec, pauseMs) {
  const overflow = textWidth - viewWidth;
  if (overflow <= 0) return 0;
  const elapsed = timeMs - pauseMs;
  if (elapsed <= 0) return 0;
  return Math.min(overflow, (elapsed / 1000) * speedPxPerSec);
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `node --test tests/`
Expected: PASS, 0 fail

- [ ] **Step 5: Коммит**

```bash
git add src tests
git commit -m "feat: pure logic for playlist, knob, camera limits and marquee"
```

---

### Task 2: Треки, аудиоплеер, каркас страницы

**Files:**
- Create: `src/tracks.js`, `src/player.js`, `index.html`, `styles/style.css`
- Modify: `.claude/launch.json` (сервить корень проекта, а не несуществующий `demo/`)

**Interfaces:**
- Consumes: `nextIndex`, `prevIndex` из `src/playlist.js`
- Produces:
  - `TRACKS: Array<{ title, artist, url, mood }>`
  - `createPlayer({ tracks, onTrackChange, onStatus }) → { play, pause, toggle, next, prev, setVolume, getVolume, getTrack, isPlaying }`
  - статусы для LCD: `'READY' | 'PLAYING' | 'PAUSED' | 'NO SIGNAL' | 'END'`

- [ ] **Step 1: Данные треков**

```js
// src/tracks.js
export const TRACKS = [
  { title: 'Lost', artist: 'Frank Ocean', url: 'assets/audio/Frank Ocean - Lost.mp3', mood: 'neutral' },
  // ...остальные пять файлов из assets/audio, mood: 'neutral' у всех
];
```

- [ ] **Step 2: Плеер**

`createPlayer` держит один `Audio`, индекс текущего трека и счётчик подряд
неудачных загрузок. На `error` вызывает `onStatus('NO SIGNAL')` и переходит к
следующему; когда счётчик достигает `tracks.length`, останавливается со статусом
`'END'`. На успешном `canplay` счётчик обнуляется. На `ended` — `next()`.

- [ ] **Step 3: index.html + стили**

`index.html` содержит `<canvas id="scene">`, стартовый оверлей с кнопкой
(обход блокировки автоплея), `<noscript>`/WebGL-фолбэк `<div id="unsupported">`
и importmap на Three.js.

- [ ] **Step 4: Проверка**

Run: `node --test tests/` — Expected: PASS (регрессий нет)
Открыть страницу локальным сервером, убедиться, что оверлей рисуется.

- [ ] **Step 5: Коммит**

```bash
git add index.html styles src .claude/launch.json
git commit -m "feat: playlist data, audio player and page shell"
```

---

### Task 3: Сцена, панорама салона и текстуры

**Files:**
- Create: `src/scene.js`, `src/textures.js`
- Create: `assets/textures/` (сгенерированные изображения)

**Interfaces:**
- Produces:
  - `createScene(canvas) → { scene, renderer, camera, render() }`
  - `loadPanelTexture(): Promise<THREE.Texture>` — сгенерированная текстура панели
    с процедурным фолбэком
  - `loadInteriorPanorama(): Promise<THREE.Texture>` — панорама салона с
    процедурным фолбэком (градиент «тёмный салон»)

- [ ] **Step 1: Сгенерировать текстуры**

Через MCP-генерацию изображений: (1) equirectangular-панорама салона старой
машины от первого лица, (2) потёртая тёмная лицевая панель автомагнитолы без
текста. Скачать в `assets/textures/`.

- [ ] **Step 2: Сцена**

Сфера радиусом 20 с `side: THREE.BackSide` и панорамой; ambient + два
направленных источника; `PerspectiveCamera` в точке глаз водителя.
Проверка `WebGLRenderingContext`: при отсутствии — показать `#unsupported` и
не создавать рендерер.

- [ ] **Step 3: Фолбэки текстур**

Если файл не загрузился — `CanvasTexture`, нарисованная кодом (панель: тёмный
шум + фаска; панорама: вертикальный градиент с силуэтом торпедо).

- [ ] **Step 4: Проверка**

Открыть страницу: салон виден, ошибок в консоли нет.

- [ ] **Step 5: Коммит**

```bash
git add src assets/textures
git commit -m "feat: three.js scene, interior panorama and texture fallbacks"
```

---

### Task 4: 3D-модель радио и LCD

**Files:**
- Create: `src/radio.js`, `src/lcd.js`

**Interfaces:**
- Consumes: `loadPanelTexture` из `src/textures.js`, `marqueeOffset` из `src/marquee.js`
- Produces:
  - `createRadio(panelTexture) → { group, controls: { seekPrev, seekNext, amBtn, fmBtn, eject, cassette, volKnob, tuneKnob }, pressButton(mesh), setKnobAngle(mesh, angle), lcd }`
  - `createLcd() → { texture, setTrack(title, artist), setStatus(text), update(timeMs) }`

- [ ] **Step 1: Геометрия**

Корпус — `BoxGeometry` со скруглением через фаску-рамку; утопленные кнопки — плоские
боксы в нишах; крутилки — цилиндры с насечкой; щель кассеты — тёмный вытянутый бокс.
Каждый интерактивный меш получает `mesh.userData.control = '<id>'`.

- [ ] **Step 2: Надписи поверх текстуры**

Код рисует AM, FM, SEEK◀, ▶SEEK, EJECT, VOL, TUNE на Canvas поверх
сгенерированной текстуры — генеративные изображения искажают текст.

- [ ] **Step 3: LCD**

`CanvasTexture` 512×160: жёлтый сегментный шрифт на тёмном фоне, верхняя строка —
название (с бегущей строкой через `marqueeOffset`), нижняя — исполнитель.
`setStatus` рисует служебный текст (`NO SIGNAL`, `END`).

- [ ] **Step 4: Проверка**

Открыть страницу: радио видно, надписи читаются, LCD показывает первый трек.

- [ ] **Step 5: Коммит**

```bash
git add src
git commit -m "feat: 3d radio model with live LCD display"
```

---

### Task 5: Камера от первого лица

**Files:**
- Create: `src/camera.js`

**Interfaces:**
- Consumes: `clampYaw`, `clampPitch`, `clampZoom` из `src/cameraMath.js`
- Produces: `createCameraRig(camera, domElement) → { update(dt), isDragging(), consumedDrag(), onWheelOverKnob(cb) }`

- [ ] **Step 1: Реализация**

Позиция камеры зафиксирована; drag меняет yaw/pitch с инерционным затуханием;
колесо меняет зум (через изменение `fov`/дистанции взгляда), значения проходят
через clamp-функции. Смещение больше 5 px помечает жест как drag, чтобы
`interaction.js` не считал его кликом.

- [ ] **Step 2: Проверка**

Run: `node --test tests/` — Expected: PASS
Вручную: голова поворачивается, назад развернуться нельзя, зум упирается в пределы.

- [ ] **Step 3: Коммит**

```bash
git add src/camera.js
git commit -m "feat: first-person camera rig with inertia and limits"
```

---

### Task 6: Рука и взаимодействие

**Files:**
- Create: `src/hand.js`, `src/interaction.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `controls` из `createRadio`, `createPlayer`, `createCameraRig`
- Produces:
  - `createHand() → { group, pressAt(worldPos): Promise<void>, grabAt(worldPos), release(), isBusy() }`
  - `createInteraction({ camera, domElement, controls, cameraRig, onPress(controlId), onKnobDrag(controlId, deltaAngle), onKnobWheel(controlId, delta) })`

- [ ] **Step 1: Рука**

Низкополигональная модель из примитивов: ладонь-бокс, четыре пальца-цилиндра,
большой палец. `pressAt` — вход в кадр за ~0.4 с, касание, возврат; промис
резолвится **в момент касания**, чтобы действие срабатывало именно тогда.
`isBusy()` блокирует новые клики во время анимации.

- [ ] **Step 2: Взаимодействие**

Raycaster по мешам с `userData.control`: hover подсвечивает (emissive) и меняет
курсор; клик (не drag, рука не занята) запускает `pressAt` и по касанию вызывает
`onPress`. Для крутилок — drag по кругу и колесо мыши: рука берётся за крутилку
и поворачивается вместе с ней.

- [ ] **Step 3: Сборка в main.js**

`seekPrev → player.prev()`, `seekNext → player.next()`, `volKnob → player.toggle()`,
`tuneKnob → player.setVolume(angleToVolume(...))`; `amBtn`, `fmBtn`, `eject`,
`cassette` — только анимация нажатия. `player.onTrackChange → lcd.setTrack`,
`player.onStatus → lcd.setStatus`.

- [ ] **Step 4: Проверка**

Вручную в браузере: клик по SEEK▶ → рука входит, кнопка утапливается, трек
переключается; drag по TUNE меняет громкость; клик по VOL ставит на паузу.
Run: `node --test tests/` — Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add src
git commit -m "feat: 3d hand animation and raycast interaction"
```

---

### Task 7: Финальная проверка и скриншоты

**Files:**
- Modify: любые по результатам проверки

- [ ] **Step 1:** `node --test tests/` — Expected: PASS, 0 fail
- [ ] **Step 2:** Запустить статик-сервер, открыть страницу, проверить консоль на ошибки
- [ ] **Step 3:** Скриншоты: стартовый кадр, отдалённый вид салона, момент нажатия рукой
- [ ] **Step 4:** Коммит
