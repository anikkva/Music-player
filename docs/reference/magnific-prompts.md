# Промты для Magnific — референсы для салона и пассажирки

Что это: набор промтов под Magnific (Mystic / Upscaler / Relight / Style
Transfer) и под видео-генерацию. Цель — не «сделать картинку», а получить
референсы, по которым дальше правится геометрия, текстуры и свет в
`src/interior.js`, `src/passenger.js`, `src/textures.js`, `src/scene.js`.

Всё, что генерируется, кладём в `docs/reference/` рядом с кадрами из GTA III.

## Что уже задано сценой (не выдумывать в промтах)

Эти цифры взяты из кода — если промт им противоречит, референс окажется
бесполезным.

| Параметр | Значение | Откуда |
|---|---|---|
| Точка съёмки | глаза водителя, камера не двигается | `src/camera.js` |
| Руль | слева (LHD), пассажирка справа | `interior.js`, seat at `x=+0.72` |
| Дистанция глаза → магнитола | 0.867 м | `camera.js: RADIO_DISTANCE` |
| Магнитола | ниже-правее глаз, повёрнута к водителю на ~22° | `layout.js` |
| Объектив (близкий зум) | ≈ 85 мм ЭФР — магнитола во весь кадр | fov 15.8° |
| Объектив (стартовый кадр) | ≈ 65 мм ЭФР | fov ~20° |
| Объектив (широкий) | ≈ 17–18 мм ЭФР — руль, стекло, пассажирское сиденье | fov 69° |
| Поворот головы | ±100° по горизонтали, ±45° по вертикали | `cameraMath.js` |
| Время суток | ночь, мокрый асфальт, город | `textures.js: proceduralPanorama` |
| Свет 1 | холодная синь через лобовое, `#a8c2dc` | `scene.js` |
| Свет 2 | натриевый фонарь справа, `#ffb768` | `scene.js` |
| Свет 3 | янтарное свечение дисплея `#ffc21a` и приборки | `scene.js`, `lcd.js` |
| Эпоха | американский седан начала 90-х, потёртый винил, ржавые подтёки | референсы GTA III |
| Пассажирка | тёмное платье на бретелях, открытые плечи, короткая юбка, тёмные длинные волосы, чёрные туфли на каблуке, руки на коленях | `passenger.js` |

---

## 0. Главный приём: не генерировать с нуля, а «фотореалить» свой же скрин

Самый полезный воркфлоу — не текст-в-картинку, а картинка-в-картинку с высокой
привязкой к структуре. Тогда референс совпадает с сценой по геометрии, и его
можно разбирать на текстуры и свет буквально попиксельно.

1. Запустить проект, выставить нужный кадр, снять скриншот 1:1 (без UI-оверлея).
2. Magnific → **Upscaler & Enhancer** (или **Style Transfer / Structure
   Reference**), скормить скриншот + промт ниже.
3. Стартовые значения ползунков: Creativity **4**, HDR **3**, Resemblance
   **1–2**, Fractality **2**, engine **Illusio** (мягкий, не ломает формы).
   Если начинает придумывать свою панель — поднять Resemblance до 4–5.

Промт к этому шагу (он же годится как «стиль» для всех остальных):

```
photorealistic interior of a worn early-1990s American sedan at night, first-person driver POV,
cracked grey-beige vinyl dashboard with rust streaks and dust in the seams, amber-lit gauge cluster,
aftermarket head unit with a glowing amber LCD in the centre stack, cold blue city light through the
raked windshield, warm sodium streetlight raking in from the right, wet asphalt reflections outside,
fuzzy dice on the rear-view mirror, shallow depth of field, film grain, cinematic night photography
```

Negative (везде одинаковый):

```
cartoon, anime, illustration, cgi render, plastic clean showroom interior, modern touchscreen,
daylight, lens flare overload, text watermark, distorted dashboard, extra steering wheel,
right-hand drive, warped hands, deformed face, extra fingers
```

---

## 1. Мастер-референс салона (постановка света)

Mystic, 16:9, максимальный реализм. Даёт эталон, по которому крутятся
интенсивности источников в `scene.js`.

```
first-person view from the driver's seat of a battered 1992 American sedan parked at night in a city,
left-hand drive, hands not visible, looking slightly right toward the centre console,
28mm lens, eye height, the raked windshield fills the top third,
dashboard is cracked grey-beige vinyl with rust bleed around the vents,
instrument cluster glows dim amber under its hood, a car stereo with an orange segment display sits
in the centre stack angled toward the driver, three HVAC knobs beneath it,
two fuzzy dice hang from the rear-view mirror,
outside: wet asphalt, distant skyline with lit windows, sodium streetlights,
lighting: cold blue-grey ambient from the windshield, warm orange spill from the right window,
tiny amber pool of light on the dash from the display,
deep shadows but every surface still readable, cinematic, photorealistic, 35mm film grain
```

Варианты той же сцены (генерить пачкой, они нужны для разных задач):
- `...looking straight ahead over the steering wheel, wide 18mm lens` — проверка
  широкого зума и A-стоек.
- `...looking down at the driver's own knees and the floor mat` — под
  `createDriverLegs()`.
- `...looking over the right shoulder at the empty passenger seat and door card`
  — под геометрию сидений и обшивки дверей.

## 2. Крупный план магнитолы (текстура фейсплейта)

Под `panelTexture()` и `radio.js`. Снимать в лоб, чтобы текстуру можно было
выпрямить и положить на плоскость.

```
extreme close-up of a worn aftermarket car head unit from the early 1990s, straight-on frontal view,
brushed dark metal faceplate with scratches, fingerprint smudges and rust creeping from the screw holes,
wide orange-amber vacuum-fluorescent display showing station text, two ribbed rotary knobs left and right,
a row of small rubber buttons labelled AM FM SEEK EJECT, a cassette slot,
lit only by its own display glow at night, 85mm macro, razor sharp, photorealistic product photography
```

## 3. Пассажирка — главный кадр (тот, что видит игрок)

Это ключевой референс: ровно тот ракурс, под которым модель из `passenger.js`
и видна.

```
young woman sitting in the passenger seat of an old sedan at night, seen from the driver's seat,
three-quarter view from her left and slightly below, she is turned a little toward the driver,
relaxed posture, hands resting in her lap, knees together angled toward the console,
dark charcoal slip dress with thin shoulder straps, bare shoulders and collarbones, short skirt,
long dark brown hair falling behind her shoulders with two strands framing her cheeks,
black heeled shoes, warm medium skin tone,
lit from her right by orange sodium streetlight through the side window, cold blue fill from the
windshield, faint amber bounce from the radio display on her knees,
cloth seat with visible bolsters behind her, 50mm lens, shallow depth of field,
photorealistic, cinematic night portrait, natural relaxed expression, calm, looking out of the window
```

Вариации, которые стоит взять сразу:
- `...she is looking at the driver and slightly smiling` — второе состояние.
- `...seen from the waist up, 85mm` — под лицо и плечи.
- `...wide 24mm, whole passenger side of the cabin visible with her in it` —
  проверка масштаба относительно сиденья и торпедо.

## 4. Пассажирка — оборотка для моделирования

Нужна на нейтральном фоне и в плоском свете, иначе тени врисуются в текстуру.

```
character turnaround sheet of a young woman, four views in one row: front, three-quarter, side profile,
back, T-pose-adjacent relaxed stance, identical character in every view,
dark charcoal slip dress with thin straps, short skirt, black heeled shoes,
long dark brown hair, medium warm skin tone,
flat even studio lighting, no cast shadows, plain light grey background, full body, orthographic feel,
reference sheet for 3D modelling, photorealistic
```

## 5. Лицо крупно — под текстуру `faceTexture()`

Сейчас лицо рисуется на канвасе кодом. Такой референс либо заменяет его
картинкой, либо служит образцом, по которому подправляются координаты глаз,
носа и губ в `passenger.js`.

```
frontal face texture reference of a young woman, dead-on symmetrical front view, neutral expression,
eyes open looking at camera, lips closed, hair pulled fully back away from the face and ears,
completely flat frontal lighting with no shadows, plain neutral grey background,
sharp focus on eyes and lips, high resolution, photorealistic, facial texture map reference
```

## 6. Материалы (тайлы и PBR)

По одному промту на материал, у Freepik/Magnific рядом лежит генерация PBR-карт
— из этих картинок стоит сразу вытащить normal/roughness.

```
seamless tileable texture of cracked grey-beige car dashboard vinyl from the early 1990s,
fine pebble grain, sun-faded, hairline cracks, dust in the crevices, top-down flat lighting, 4k
```
```
seamless tileable texture of worn dark grey automotive seat cloth, coarse weave, slight pilling,
faded stains, top-down flat lighting, 4k
```
```
seamless tileable texture of scratched dark brushed metal panel with rust bleeding from screw holes,
horizontal brushing, greasy fingerprints, top-down flat lighting, 4k
```

## 7. Панорама за стеклом (equirectangular)

Заменяет `proceduralPanorama()`. Соотношение строго 2:1, целевой размер 4096×2048.

```
equirectangular 360 panorama, HDRI, empty city street at night seen from the middle of the road,
wet asphalt with long reflections of sodium streetlights, low-rise blocks and a distant skyline with
scattered lit windows, magenta-to-deep-blue sky gradient near the horizon, no people, no cars close by,
no visible seam, 2:1 aspect ratio, photorealistic, high dynamic range
```

Проверять по шву: сфера в `scene.js` радиусом 30 м, стык будет виден при
повороте головы вправо.

---

## Видео

Два разных применения — и промты у них разные.

### 8. Плейт за лобовое стекло (можно завести как VideoTexture)

Петля, которая реально играет за стеклом вместо статичной панорамы.

```
locked-off static camera, night city street seen straight ahead through a car windshield from inside,
the car is standing still at a red light, wet asphalt, sodium streetlights, occasional car passing
left to right with headlight sweep, distant traffic light cycling, gentle rain haze,
no camera movement, no people crossing, seamless loop, photorealistic, cinematic night, 10 seconds
```

Если нужен именно проезд, а не стоянка: `slow forward drive along an empty
night street, steady dolly forward, streetlights passing overhead`.

### 9. Референс микро-анимации пассажирки

Не для рендера, а чтобы понять, какие три-четыре движения оживляют модель.

```
young woman sitting in the passenger seat of a moving car at night, static camera from the driver's seat,
three-quarter view, she breathes calmly, tucks a strand of hair behind her ear, turns her head toward
the driver and back to the window, subtle weight shift, no talking,
warm streetlight passing across her face in rhythm, cold blue fill from the windshield,
photorealistic, cinematic, shallow depth of field, 8 seconds
```

### 10. Референс движения руки к магнитоле

Под `hand.js` — как рука входит в кадр и как ложатся пальцы на крутилку.

```
close-up from the driver's point of view, a hand reaches from the bottom right of frame toward a car
stereo, fingers turn the volume knob, then the hand withdraws, static camera, night, amber display glow,
photorealistic, 5 seconds
```

---

## Оговорки

- Стиль GTA III берём как ориентир по настроению и эпохе, но в промтах его не
  называем: просим «потрёпанный американский седан начала 90-х ночью». Так и
  результат чище, и это не попытка воспроизвести чужие ассеты.
- Сгенерированные фото — референс для ручной работы над текстурами и светом.
  Если картинка кладётся в проект как есть, у неё должна быть подходящая
  лицензия на коммерческое/публичное использование — сайт лежит на Netlify.
- Ракурс важнее красоты: кадр, снятый не с высоты глаз водителя, для правки
  геометрии бесполезен, каким бы фотореалистичным он ни был.

---

## Что уже сгенерировано

Лежит в `docs/reference/generated/` (Seedream 5 Pro, кроме панорамы — Recraft V4.1):

| Файл | Промт | Годность |
|---|---|---|
| `interior-1.jpg`, `interior-2.jpg` | §1 | эталон света: холодная синь сверху, натрий справа, янтарь дисплея |
| `passenger-1.jpg`, `passenger-2.jpg` | §3 | поза, платье, свет по фигуре; ракурс дальше, чем у камеры водителя |
| `radio.jpg` | §2 | почти совпадает с раскладкой `radio.js` — прямой референс фейсплейта |
| `face.jpg` | §5 | плоский свет, прямой фас — под `faceTexture()` |
| `panorama.png` | §7 | настоящая equirectangular, но 1536×768 при целевых 4096×2048 |
