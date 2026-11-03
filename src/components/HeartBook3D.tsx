"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HEART_H, HEART_SEGMENTS, HEART_START, HEART_SVG_PATH, HEART_W, halfHeartPath, heartTo3D, sampleHeart } from "@/lib/heart";
import type { Settings } from "@/lib/client";

export type Rect = { x: number; y: number; w: number; h: number };
export type Insets = { top: number; bottom: number };

type Props = {
  open: boolean;
  flip: { id: number; dir: 1 | -1 } | null;
  settings: Settings;
  titleFont: string;
  reducedMotion: boolean;
  insets: Insets;
  onRect: (r: Rect | null) => void;
  onCoverClick: () => void;
};

/** 터치 기기(태블릿·폰)는 해상도·그림자를 낮춰 가볍게 */
const COARSE = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const COVER_T = 0.05; // 표지 두께
const BLOCK_T = 0.16; // 내지 묶음 두께
const PAGE_Z = COVER_T + BLOCK_T; // 내지 윗면 높이
const DOOR_SCALE = 1.03; // 표지는 내지보다 살짝 크다
const HINGE_X = (HEART_W / 2) * DOOR_SCALE * 0.985; // 양문 힌지(하트 좌우 끝)
const DOOR_OPEN = Math.PI - 0.12; // 다 열면 바깥쪽 끝이 탁자에 살짝 닿는다
const RIBBON_COLORS: Record<string, string> = { rose: "#E58FA5", cream: "#FFF1E0", lilac: "#C9B3E6", cherry: "#A94C68" };
const CHAIN_COLORS: Record<string, string> = { gold: "#D9B56F", silver: "#C9CDD6" };

type Side = "full" | "left" | "right";

/** 하트(또는 가운데 세로선에서 자른 반쪽) 외곽선 */
function heartShape(scale = 1, side: Side = "full", dx = 0): THREE.Shape {
  const P = (u: number, v: number): [number, number] => {
    const [x, y] = heartTo3D(u, v, scale);
    return [x + dx, y];
  };
  const s = new THREE.Shape();
  if (side === "full") {
    s.moveTo(...P(...HEART_START));
    for (const g of HEART_SEGMENTS) s.bezierCurveTo(...P(g[0], g[1]), ...P(g[2], g[3]), ...P(g[4], g[5]));
    return s;
  }
  const h = halfHeartPath(side);
  s.moveTo(...P(...h.start));
  for (const g of h.segs) s.bezierCurveTo(...P(g[0], g[1]), ...P(g[2], g[3]), ...P(g[4], g[5]));
  s.lineTo(...P(...h.close));
  return s;
}

/** 하트 전체 바운딩 박스 기준으로 UV를 0..1로 다시 매긴다 (반쪽도 같은 텍스처의 절반을 갖는다) */
function fitUV(geo: THREE.BufferGeometry, scale = 1, dx = 0) {
  const w = HEART_W * scale, h = HEART_H * scale;
  const minX = -w / 2 + dx, minY = -h / 2;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - minX) / w;
    uv[i * 2 + 1] = (pos.getY(i) - minY) / h;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

/** 누빔 가죽 */
function leatherTexture(color: string) {
  return canvasTex(1024, 952, (c) => {
    c.fillStyle = color;
    c.fillRect(0, 0, 1024, 952);
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "120,40,60"},${Math.random() * 0.05})`;
      c.fillRect(Math.random() * 1024, Math.random() * 952, 2, 2);
    }
    const step = 92;
    for (let k = -12; k < 24; k++) {
      for (const dir of [1, -1]) {
        const x0 = k * step;
        c.strokeStyle = shade(color, -0.12);
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(x0, 0);
        c.lineTo(x0 + dir * 952, 952);
        c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.35)";
        c.lineWidth = 2;
        c.setLineDash([10, 8]);
        c.beginPath();
        c.moveTo(x0 + 5, 0);
        c.lineTo(x0 + 5 + dir * 952, 952);
        c.stroke();
        c.setLineDash([]);
      }
    }
  });
}

function heartPath2D(w: number, h: number, scale = 1) {
  const p = new Path2D();
  const m = new DOMMatrix().translate(w / 2, h / 2).scale(scale, scale).translate(-w / 2, -h / 2).scale(w, h);
  p.addPath(new Path2D(HEART_SVG_PATH), m);
  return p;
}

/** 표지 중앙 크림 하트 + 금박 제목 + 월계수 */
function decalTexture(font: string) {
  return canvasTex(1024, 952, (c) => {
    const W = 1024, H = 952;
    const heart = heartPath2D(W, H, 0.96);
    c.fillStyle = "#FFF6EB";
    c.fill(heart);
    c.save();
    c.clip(heart);
    const g = c.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.45, 600);
    g.addColorStop(0, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(232,166,181,0.25)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.restore();
    c.strokeStyle = "#E3A9B8";
    c.lineWidth = 5;
    c.setLineDash([16, 12]);
    c.stroke(heartPath2D(W, H, 0.88));
    c.setLineDash([]);
    // 월계수 가지
    const gold = c.createLinearGradient(0, H * 0.2, 0, H * 0.7);
    gold.addColorStop(0, "#E9CE8E");
    gold.addColorStop(0.5, "#C8A56A");
    gold.addColorStop(1, "#A9823F");
    for (const side of [-1, 1]) {
      c.save();
      c.translate(W / 2 + side * 270, H * 0.42);
      c.scale(side, 1);
      c.strokeStyle = gold;
      c.fillStyle = gold;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(0, 150);
      c.quadraticCurveTo(-40, 20, 20, -120);
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const x = -20 * Math.sin(t * Math.PI) + t * 20, y = 140 - t * 250;
        c.save();
        c.translate(x, y);
        c.rotate(-0.9);
        c.beginPath();
        c.ellipse(-16, 0, 22, 8, 0, 0, Math.PI * 2);
        c.fill();
        c.rotate(1.6);
        c.beginPath();
        c.ellipse(16, 0, 22, 8, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      c.restore();
    }
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `700 150px ${font}`;
    c.shadowColor = "rgba(120,70,20,0.35)";
    c.shadowOffsetY = 4;
    c.shadowBlur = 6;
    c.fillStyle = gold;
    c.fillText("Heart", W / 2 - 20, H * 0.33);
    c.fillText("Diary", W / 2 + 30, H * 0.5);
    c.shadowColor = "transparent";
    c.font = `600 36px ${font}`;
    c.fillStyle = "#C8A56A";
    c.fillText("♥", W / 2, H * 0.63);
  });
}

/** 크림 종이 + 레이스 테두리 */
function paperTexture() {
  return canvasTex(1024, 952, (c) => {
    const W = 1024, H = 952;
    c.fillStyle = "#FFF6EB";
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 14000; i++) {
      c.fillStyle = `rgba(190,150,120,${Math.random() * 0.06})`;
      c.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    c.strokeStyle = "#F0BFCB";
    c.lineWidth = 10;
    c.stroke(heartPath2D(W, H, 0.95));
    c.strokeStyle = "#F7D7DF";
    c.lineWidth = 3;
    c.setLineDash([8, 10]);
    c.stroke(heartPath2D(W, H, 0.9));
    c.setLineDash([]);
    // 가운데 제본선과 안쪽 그늘
    const g = c.createLinearGradient(W / 2 - 40, 0, W / 2 + 40, 0);
    g.addColorStop(0, "rgba(169,76,104,0)");
    g.addColorStop(0.5, "rgba(169,76,104,0.16)");
    g.addColorStop(1, "rgba(169,76,104,0)");
    c.fillStyle = g;
    c.fillRect(W / 2 - 40, 0, 80, H);
    c.strokeStyle = "rgba(169,76,104,0.45)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(W / 2, H * 0.2);
    c.lineTo(W / 2, H * 0.97);
    c.stroke();
  });
}

function tableTexture() {
  return canvasTex(512, 512, (c) => {
    c.fillStyle = "#EFC6D1";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) {
      c.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
      c.fillRect(Math.random() * 512, Math.random() * 512, 2, 1);
    }
  });
}

function useEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
}

function Ribbon({ color, position }: { color: string; position: [number, number, number] }) {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, sheen: 1, sheenColor: new THREE.Color("#fff"), clearcoat: 0.3 }), [color]);
  return (
    <group position={position}>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat} position={[s * 0.17, 0.02, 0]} rotation={[0, 0, s * 0.25]} scale={[1, 0.6, 0.45]} castShadow>
          <torusGeometry args={[0.15, 0.05, 14, 40]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`t${s}`} material={mat} position={[s * 0.1, -0.2, -0.01]} rotation={[0, 0, s * 0.35]} castShadow>
          <boxGeometry args={[0.075, 0.32, 0.018]} />
        </mesh>
      ))}
      <mesh material={mat} scale={[1, 0.85, 0.7]} castShadow>
        <sphereGeometry args={[0.065, 24, 16]} />
      </mesh>
    </group>
  );
}

function Charm({ kind, gold }: { kind: string; gold: THREE.Material }) {
  const pink = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#F4A7BE", roughness: 0.1, clearcoat: 1, transmission: 0.3, thickness: 0.2 }), []);
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFF7F2", roughness: 0.8 }), []);
  const brown = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C99670", roughness: 0.85 }), []);
  const blush = useMemo(() => new THREE.MeshStandardMaterial({ color: "#F29BB2", roughness: 0.7 }), []);
  const heartGeo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.05);
    s.bezierCurveTo(0.03, 0.12, 0.13, 0.1, 0.12, 0.02);
    s.bezierCurveTo(0.11, -0.05, 0.03, -0.09, 0, -0.13);
    s.bezierCurveTo(-0.03, -0.09, -0.11, -0.05, -0.12, 0.02);
    s.bezierCurveTo(-0.13, 0.1, -0.03, 0.12, 0, 0.05);
    return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.03, bevelSegments: 4 });
  }, []);
  const starGeo = useMemo(() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.06 : 0.14, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.02, bevelSegments: 3 });
  }, []);
  if (kind === "star") return <mesh geometry={starGeo} material={gold} position={[0, -0.13, 0]} castShadow />;
  if (kind === "bunny" || kind === "bear") {
    const m = kind === "bunny" ? white : brown;
    return (
      <group position={[0, -0.16, 0]}>
        <mesh material={m} castShadow>
          <sphereGeometry args={[0.1, 24, 18]} />
        </mesh>
        {[-1, 1].map((s) =>
          kind === "bunny" ? (
            <mesh key={s} material={m} position={[s * 0.045, 0.14, 0]} rotation={[0, 0, -s * 0.15]} castShadow>
              <capsuleGeometry args={[0.025, 0.1, 6, 12]} />
            </mesh>
          ) : (
            <mesh key={s} material={m} position={[s * 0.075, 0.075, 0]} castShadow>
              <sphereGeometry args={[0.035, 16, 12]} />
            </mesh>
          ),
        )}
        {[-1, 1].map((s) => (
          <mesh key={`c${s}`} material={blush} position={[s * 0.05, -0.02, 0.085]} scale={[1, 0.6, 0.4]}>
            <sphereGeometry args={[0.018, 12, 8]} />
          </mesh>
        ))}
        <mesh material={pink} position={[0, -0.2, 0]} rotation={[0, 0, 0]} scale={0.9} geometry={heartGeo} />
      </group>
    );
  }
  return <mesh geometry={heartGeo} material={pink} position={[0, -0.06, -0.02]} castShadow />;
}

function Chain({ color, charm }: { color: string; charm: string }) {
  const ref = useRef<THREE.Group>(null);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.25 }), [color]);
  const pearl = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#FFFDF8", roughness: 0.15, clearcoat: 1, sheen: 1 }), []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.3) * 0.06;
  });
  const n = 9;
  return (
    <group ref={ref}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} material={gold} position={[0, -i * 0.075, 0]} rotation={[0, i % 2 ? Math.PI / 2 : 0, 0]} castShadow>
          <torusGeometry args={[0.035, 0.009, 8, 20]} />
        </mesh>
      ))}
      <mesh material={pearl} position={[0, -n * 0.075 + 0.01, 0]} castShadow>
        <sphereGeometry args={[0.04, 20, 14]} />
      </mesh>
      <group position={[0, -n * 0.075 - 0.03, 0]}>
        <Charm kind={charm} gold={gold} />
      </group>
    </group>
  );
}

function Door({ side, geo, mats, ribbonColor, refObj }: {
  side: "left" | "right";
  geo: ReturnType<typeof makeDoorGeo>;
  mats: Record<string, THREE.Material>;
  ribbonColor: string;
  refObj: RefObject<THREE.Group | null>;
}) {
  const dx = side === "left" ? HINGE_X : -HINGE_X;
  const [lkx, lky] = heartTo3D(0.5, 0.645);
  const [rbx, rby] = heartTo3D(0.6, 0.79);
  return (
    <group ref={refObj} position={[side === "left" ? -HINGE_X : HINGE_X, 0, PAGE_Z + 0.005]}>
      <mesh geometry={geo.cover} material={mats.leather} castShadow receiveShadow />
      <mesh geometry={geo.decal} material={mats.decal} position={[0, 0.18, COVER_T + 0.009]} />
      <mesh geometry={geo.inner} material={mats.paper} position={[0, 0, -0.03]} />
      {geo.lace.map(([x, y], i) => (
        <mesh key={i} material={mats.lace} position={[x, y, COVER_T - 0.01]} castShadow>
          <sphereGeometry args={[0.045, 10, 8]} />
        </mesh>
      ))}
      {side === "left" ? (
        <>
          {/* 양문을 잠그는 가죽 끈 + 금 하트 자물쇠 (가운데 이음새 위) */}
          <mesh material={mats.strap} position={[lkx + dx, lky, COVER_T + 0.012]} castShadow>
            <boxGeometry args={[0.6, 0.2, 0.03]} />
          </mesh>
          <mesh geometry={geo.lock} material={mats.gold} position={[lkx + dx, lky + 0.02, COVER_T + 0.03]} castShadow />
        </>
      ) : (
        <Ribbon color={ribbonColor} position={[rbx + dx, rby, COVER_T + 0.06]} />
      )}
    </group>
  );
}

function makeDoorGeo(side: "left" | "right") {
  const dx = side === "left" ? HINGE_X : -HINGE_X;
  const ext = (scale: number, depth: number) =>
    fitUV(
      new THREE.ExtrudeGeometry(heartShape(scale, side, dx), {
        depth,
        bevelEnabled: true,
        bevelSize: 0.03,
        bevelThickness: 0.025,
        bevelSegments: 5,
        curveSegments: 48,
      }),
      scale,
      dx,
    );
  const flat = (scale: number) => fitUV(new THREE.ShapeGeometry(heartShape(scale, side, dx), 64), scale, dx);
  const lock = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.05);
    s.bezierCurveTo(0.025, 0.125, 0.125, 0.1, 0.12, 0.02);
    s.bezierCurveTo(0.11, -0.05, 0.04, -0.09, 0, -0.125);
    s.bezierCurveTo(-0.04, -0.09, -0.11, -0.05, -0.12, 0.02);
    s.bezierCurveTo(-0.125, 0.1, -0.025, 0.125, 0, 0.05);
    return new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.018, bevelSegments: 3 });
  })();
  return {
    cover: ext(DOOR_SCALE, COVER_T - 0.02),
    decal: flat(0.72),
    inner: flat(0.98),
    lock,
    lace: sampleHeart(140)
      .filter(([u]) => (side === "left" ? u < 0.49 : u > 0.51))
      .map(([u, v]) => {
        const [x, y] = heartTo3D(u, v, 1.06);
        return [x + dx, y] as [number, number];
      }),
  };
}

function Book({ open, flip, settings, titleFont, reducedMotion, insets, onRect, onCoverClick }: Props) {
  useEnvironment();
  const { camera, size, invalidate } = useThree();
  const bookRef = useRef<THREE.Group>(null);
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const flipRef = useRef<THREE.Group>(null);
  const angle = useRef(0); // 0 = 닫힘, 1 = 활짝 열림
  const flipState = useRef<{ t: number; dir: 1 | -1 } | null>(null);
  const lastRect = useRef("");
  const [fontReady, setFontReady] = useState(0);

  useEffect(() => {
    document.fonts?.ready.then(() => setFontReady((n) => n + 1));
  }, []);

  const geo = useMemo(() => {
    const ext = (scale: number, depth: number, bevel: boolean) =>
      fitUV(
        new THREE.ExtrudeGeometry(heartShape(scale), {
          depth,
          bevelEnabled: bevel,
          bevelSize: 0.03,
          bevelThickness: 0.025,
          bevelSegments: 5,
          curveSegments: 48,
        }),
        scale,
      );
    return {
      back: ext(DOOR_SCALE, COVER_T - 0.02, true),
      block: ext(0.995, BLOCK_T, false),
      paper: fitUV(new THREE.ShapeGeometry(heartShape(0.98), 64), 0.98),
      leaf: fitUV(new THREE.ShapeGeometry(heartShape(0.975, "right"), 64), 0.975),
      left: makeDoorGeo("left"),
      right: makeDoorGeo("right"),
    };
  }, []);

  const tex = useMemo(() => ({ paper: paperTexture(), table: tableTexture() }), []);
  const leather = useMemo(() => leatherTexture(settings.cover_color), [settings.cover_color]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const decal = useMemo(() => decalTexture(titleFont), [titleFont, fontReady]);

  const mats = useMemo(
    () => ({
      leather: new THREE.MeshPhysicalMaterial({ map: leather, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color("#fff0f4"), clearcoat: 0.15 }),
      decal: new THREE.MeshStandardMaterial({ map: decal, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
      paperSide: new THREE.MeshStandardMaterial({ color: "#FBEFE2", roughness: 0.95 }),
      paper: new THREE.MeshStandardMaterial({ map: tex.paper, roughness: 0.9, side: THREE.DoubleSide }),
      leaf: new THREE.MeshStandardMaterial({ color: "#FFF6EB", roughness: 0.9, side: THREE.DoubleSide }),
      lace: new THREE.MeshStandardMaterial({ color: "#FFFBF7", roughness: 0.7 }),
      gold: new THREE.MeshStandardMaterial({ color: "#D6B26E", metalness: 0.95, roughness: 0.25 }),
      strap: new THREE.MeshStandardMaterial({ color: shade(settings.cover_color, -0.12), roughness: 0.6 }),
      table: new THREE.MeshStandardMaterial({ map: tex.table, roughness: 1 }),
    }),
    [leather, decal, tex, settings.cover_color],
  );

  useEffect(() => {
    if (flip) flipState.current = { t: 0, dir: flip.dir };
  }, [flip]);

  // 필요할 때만 다시 그린다 (펼쳐져 멈춰 있으면 3D는 쉬고 펜 그리기에 힘을 몰아준다)
  useEffect(() => invalidate(), [open, flip, insets.top, insets.bottom, settings, size.width, size.height, invalidate]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const speed = reducedMotion ? 9 : 2.4;
    const target = open ? 1 : 0;
    angle.current += (target - angle.current) * Math.min(1, d * speed);
    if (Math.abs(target - angle.current) < 0.0015) angle.current = target;
    // 왼쪽 문이 먼저, 오른쪽 문이 살짝 늦게 열린다 (자물쇠 끈이 왼쪽 문에 달려 있어서)
    const a = angle.current;
    const la = Math.min(1, a * 1.15), ra = Math.max(0, Math.min(1, (a - 0.08) * 1.1));
    if (leftRef.current) leftRef.current.rotation.y = -DOOR_OPEN * la;
    if (rightRef.current) rightRef.current.rotation.y = DOOR_OPEN * (open ? ra : Math.min(ra, la));

    const b = bookRef.current;
    if (b) {
      const k = Math.min(1, d * 3);
      const tRot = open ? [0, 0, 0] : [-0.3, 0.22, 0.04];
      b.rotation.x += (tRot[0] - b.rotation.x) * k;
      b.rotation.y += (tRot[1] - b.rotation.y) * k;
      b.rotation.z += (tRot[2] - b.rotation.z) * k;
      const bob = open || reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 1.2) * 0.04;
      b.position.y += (bob - b.position.y) * k;
      const lift = open ? 0 : 0.75;
      b.position.z += (lift - b.position.z) * k;
      if (open && Math.abs(b.rotation.x) < 0.0005) b.rotation.set(0, 0, 0);
      if (open && Math.abs(b.position.z) < 0.0005) b.position.z = 0;
      if (open && Math.abs(b.position.y) < 0.0005) b.position.y = 0;
    }

    // 카메라: 펼친 하트가 위 메뉴바와 아래 트레이 사이에 꽉 차도록
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const usable = Math.max(0.3, (size.height - insets.top - insets.bottom) / size.height);
    const needW = open ? HEART_W * 1.06 : HEART_W * 1.45;
    const needH = open ? HEART_H * 1.04 : HEART_H * 1.3;
    const dist = Math.max(needW / (2 * tanH * aspect), needH / (2 * tanH * usable));
    const cy = ((insets.top - insets.bottom) / size.height) * tanH * dist;
    // 화면 전환(아래 트레이 높이 변화)은 책장 넘김 시간 안에 끝나도록 빠르게 따라간다
    const kc = Math.min(1, d * (open ? 7 : 3.2));
    const p = cam.position;
    p.x += (0 - p.x) * kc;
    p.y += (cy - p.y) * kc;
    p.z += (dist + PAGE_Z - p.z) * kc;
    if (Math.abs(p.x) + Math.abs(cy - p.y) + Math.abs(dist + PAGE_Z - p.z) < 0.004) p.set(0, cy, dist + PAGE_Z);
    cam.lookAt(p.x, p.y, 0);

    // 가운데 제본선을 축으로 반쪽 하트 종이가 넘어간다
    const fs = flipState.current;
    const fr = flipRef.current;
    if (fr) {
      if (fs) {
        fs.t = Math.min(1, fs.t + d / (reducedMotion ? 0.2 : 0.62));
        const e = fs.t < 0.5 ? 2 * fs.t * fs.t : 1 - Math.pow(-2 * fs.t + 2, 2) / 2;
        fr.visible = true;
        fr.rotation.y = fs.dir === 1 ? -Math.PI * e : -Math.PI * (1 - e);
        fr.position.z = PAGE_Z + 0.006 + Math.sin(e * Math.PI) * 0.12;
        fr.scale.x = 1 - Math.sin(e * Math.PI) * 0.1;
        if (fs.t >= 1) flipState.current = null;
      } else fr.visible = false;
    }

    // 펼쳐진 뒤 HTML 편집 레이어가 얹힐 화면 좌표
    const settled = open && a === 1 && b && b.rotation.x === 0 && b.position.z === 0 && b.position.y === 0 && p.y === cy;
    if (!settled) {
      if (lastRect.current) {
        lastRect.current = "";
        onRect(null);
      }
      invalidate();
      return;
    }
    if (flipState.current) invalidate();
    const proj = (x: number, y: number) => {
      const v = new THREE.Vector3(x, y, PAGE_Z).project(cam);
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
    };
    const [x0, y0] = proj(-HEART_W / 2, HEART_H / 2);
    const [x1, y1] = proj(HEART_W / 2, -HEART_H / 2);
    const r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const key = [r.x, r.y, r.w, r.h].map((n) => Math.round(n)).join(",");
    if (key !== lastRect.current) {
      lastRect.current = key;
      onRect(r);
    }
  });

  const ribbonColor = RIBBON_COLORS[settings.ribbon_key] ?? RIBBON_COLORS.rose;
  const [chx, chy] = heartTo3D(0.965, 0.25, 1.03);

  return (
    <>
      <ambientLight intensity={0.15} />
      <hemisphereLight args={["#fff5f7", "#e9b6c4", 0.3]} />
      <directionalLight
        position={[-3, 4, 7]}
        intensity={1.25}
        castShadow
        shadow-mapSize={COARSE ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      <pointLight position={[3, 2, 4]} intensity={3} color="#ffd9e2" />

      <mesh position={[0, 0, -0.03]} material={mats.table} receiveShadow>
        <planeGeometry args={[40, 26]} />
      </mesh>

      <group ref={bookRef}>
        <group
          onClick={(e) => {
            e.stopPropagation();
            if (!open) onCoverClick();
          }}
          onPointerOver={() => !open && (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          {/* 뒤판 + 내지 묶음 */}
          <mesh geometry={geo.back} material={mats.leather} castShadow receiveShadow />
          <mesh geometry={geo.block} material={[mats.paperSide, mats.paperSide]} position={[0, 0, COVER_T - 0.01]} castShadow receiveShadow />
          <mesh geometry={geo.paper} material={mats.paper} position={[0, 0, PAGE_Z + 0.001]} receiveShadow />

          {/* 양문형 앞표지 */}
          <Door side="left" geo={geo.left} mats={mats} ribbonColor={ribbonColor} refObj={leftRef} />
          <Door side="right" geo={geo.right} mats={mats} ribbonColor={ribbonColor} refObj={rightRef} />

          {/* 책장 넘김용 반쪽 하트 종이 (가운데 x=0이 축) */}
          <group ref={flipRef} position={[0, 0, PAGE_Z + 0.006]} visible={false}>
            <mesh geometry={geo.leaf} material={mats.leaf} castShadow />
          </group>

          {settings.chain_key !== "none" && (
            <group position={[chx, chy, PAGE_Z + 0.14]}>
              <Chain color={CHAIN_COLORS[settings.chain_key] ?? CHAIN_COLORS.gold} charm={settings.charm_key} />
            </group>
          )}
        </group>
      </group>
    </>
  );
}

export default function HeartBook3D(props: Props) {
  return (
    <Canvas
      shadows
      dpr={COARSE ? [1, 1.5] : [1, 2]}
      frameloop="demand"
      camera={{ fov: 32, position: [0, 0, 9], near: 0.1, far: 80 }}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 0.95;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Book {...props} />
    </Canvas>
  );
}
