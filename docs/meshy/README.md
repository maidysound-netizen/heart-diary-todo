# Meshy로 표지·참 만들기 가이드

## 만들 것 (3개)

| 파일 이름 | 참고 이미지 | 앱에서 쓰는 곳 |
| --- | --- | --- |
| `cover.glb` | `ref_cover.png` | 앞표지 (앱에서 가운데를 잘라 양문으로 열리게 함) |
| `charm_doll.glb` | `ref_charm_doll.png` | 체인에 매다는 인형 참 |
| `charm_heart.glb` | `ref_charm_doll.png` 왼쪽 위 핑크 하트 크리스털 | 하트 크리스털 참 (선택) |

## Meshy 설정 (Image to 3D)

1. meshy.ai → **Image to 3D** → 참고 이미지를 올린다.
2. 설정
   - AI Model: 최신 버전 (Meshy 5 / 6 등)
   - Topology: **Triangle**
   - Target Polycount: 표지 **30,000**, 인형 **15,000**, 하트 **5,000** (웹에서 가볍게)
   - Symmetry: 표지는 **Auto**, 인형·하트는 **On**
   - Texture: **PBR 켜기**, 해상도 2048
3. 미리보기 4개 중 가장 깔끔한 것을 고르고 **Texture** 단계까지 진행한다.
4. **Download → GLB** 로 받는다.

### 잘 나오게 하는 팁
- 표지 결과에서 하트 윤곽이 또렷하고, 앞면이 평평하고, 리본·자물쇠가 앞면에 붙어 있는 것을 고른다.
- 뒷면은 대충 나와도 괜찮다 (앱에서 뒤판·내지는 따로 그린다).
- 글자("Heart Diary")가 뭉개지면 괜찮다. 앱에서 금박 제목을 위에 다시 얹을 수 있다.
- 결과가 마음에 안 들면 **Text to 3D**로 다시 시도:
  - 표지: `a heart-shaped diary cover, front view, pink quilted leather with stitching, white lace trim around the edge, cream heart-shaped center panel with gold embossed laurel, pink satin ribbon bow with a small gold heart padlock, luxury stationery, cute, high detail`
  - 인형: `a tiny cute chibi plush doll keychain charm, girl with long wavy light brown hair, pink ribbon bows, lace headband, pink ruffled dress with a heart, closed smiling eyes, soft clay texture`

## 받은 뒤
- 받은 `.glb` 파일 경로(예: `~/Downloads/cover.glb`)를 알려주면, 웹용으로 최적화해서 `public/models/`에 넣고 표지에 연결한다.

## 라이선스 주의
- Meshy 무료 플랜 결과물은 공개·저작자 표시(CC BY 4.0) 조건이 붙고, 상업적 출시는 유료 플랜이 필요할 수 있다. 출시 전에 Meshy 약관에서 현재 조건을 확인한다.
