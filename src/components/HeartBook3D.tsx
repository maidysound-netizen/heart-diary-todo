"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HEART_SEGMENTS, HEART_START, HEART_SVG_PATH, PAGE_H, PAGE_W, heartTo3D, sampleHeart } from "@/lib/heart";
import type { Settings } from "@/lib/client";

export type Rect = { x: number; y: number; w: number; h: number };
export type SpreadRects = { left: Rect; right: Rect };
export type Focus = "both" | "left" | "right";

type Props = {
  open: boolean;
  focus: Focus;
  flip: { id: number; dir: 1 | -1 } | null;
  settings: Settings;
  titleFont: string;
  reducedMotion: boolean;
  topInset: number;
  onRects: (r: SpreadRects | null) => void;
  onCoverClick: () => void;
};

const COVER_T = 0.05; // 표지 두께
const BLOCK_T = 0.14; // 내지 묶음 두께
const PAGE_Z = COVER_T + BLOCK_T; // 내지 윗면 높이
const CX = heartTo3D(0.5, 0.5)[0]; // 오른쪽 페이지 중심 x
const RIBBON_COLORS: Record<string, string> = { rose: "#E58FA5", cream: "#FFF1E0", lilac: "#C9B3E6", cherry: "#A94C68" };
const CHAIN_COLORS: Record<string, string> = { gold: "#D9B56F", silver: "#C9CDD6" };

function heartShape(scale = 1, mirror = false): THREE.Shape {
  const P = (u: number, v: number): [number, number] => {
    const [x, y] = heartTo3D(u, v, scale);
    return [mirror ? -x : x, y];
  };
  const s = new THREE.Shape();
  s.moveTo(...P(...HEART_START));
  for (const g of HEART_SEGMENTS) s.bezierCurveTo(...P(g[0], g[1]), ...P(g[2], g[3]), ...P(g[4], g[5]));
  return s;
}

/** 하트 바운딩 박스 기준으로 UV를 0..1로 다시 매긴다 (캔버스 텍스처가 하트에 딱 맞게) */
function fitUV(geo: THREE.BufferGeometry, scale = 1) {
  const minX = CX - (PAGE_W / 2) * scale, w = PAGE_W * scale;
  const minY = (-PAGE_H / 2) * scale, h = PAGE_H * scale;
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

function Book({ open, focus, flip, settings, titleFont, reducedMotion, topInset, onRects, onCoverClick }: Props) {
  useEnvironment();
  const { camera, size } = useThree();
  const bookRef = useRef<THREE.Group>(null);
  const coverRef = useRef<THREE.Group>(null);
  const flipRef = useRef<THREE.Group>(null);
  const angle = useRef(0);
  const flipState = useRef<{ t: number; dir: 1 | -1 } | null>(null);
  const lastRects = useRef("");
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
    const flat = (scale: number) => fitUV(new THREE.ShapeGeometry(heartShape(scale), 64), scale);
    return {
      cover: ext(1.03, COVER_T - 0.02, true),
      block: ext(0.995, BLOCK_T, false),
      paper: flat(0.98),
      decal: flat(0.74),
      lace: sampleHeart(110).map(([u, v]) => heartTo3D(u, v, 1.06)),
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
      lace: new THREE.MeshStandardMaterial({ color: "#FFFBF7", roughness: 0.7 }),
      gold: new THREE.MeshStandardMaterial({ color: "#D6B26E", metalness: 0.95, roughness: 0.25 }),
      strap: new THREE.MeshStandardMaterial({ color: shade(settings.cover_color, -0.1), roughness: 0.6 }),
      table: new THREE.MeshStandardMaterial({ map: tex.table, roughness: 1 }),
    }),
    [leather, decal, tex, settings.cover_color],
  );

  useEffect(() => {
    if (flip) flipState.current = { t: 0, dir: flip.dir };
  }, [flip]);

  const lockHeart = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.04);
    s.bezierCurveTo(0.02, 0.1, 0.1, 0.08, 0.095, 0.015);
    s.bezierCurveTo(0.09, -0.04, 0.03, -0.07, 0, -0.1);
    s.bezierCurveTo(-0.03, -0.07, -0.09, -0.04, -0.095, 0.015);
    s.bezierCurveTo(-0.1, 0.08, -0.02, 0.1, 0, 0.04);
    return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.015, bevelSegments: 3 });
  }, []);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const speed = reducedMotion ? 9 : 2.6;
    const target = open ? -Math.PI : 0;
    angle.current += (target - angle.current) * Math.min(1, d * speed);
    if (Math.abs(target - angle.current) < 0.002) angle.current = target;
    if (coverRef.current) coverRef.current.rotation.y = angle.current;

    // 책 자세: 닫힘 → 살짝 비스듬히 떠 있는 3/4 뷰, 열림 → 정면
    const b = bookRef.current;
    if (b) {
      const k = Math.min(1, d * 3);
      const tRot = open ? [0, 0, 0] : [-0.28, 0.3, 0.05];
      b.rotation.x += (tRot[0] - b.rotation.x) * k;
      b.rotation.y += (tRot[1] - b.rotation.y) * k;
      b.rotation.z += (tRot[2] - b.rotation.z) * k;
      const bob = open || reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 1.2) * 0.03;
      b.position.y += (bob - b.position.y) * k;
      // 기울일 때 책이 탁자 아래로 파고들지 않도록 띄운다
      const lift = open ? 0 : 0.62;
      b.position.z += (lift - b.position.z) * k;
      if (open && Math.abs(b.position.z) < 0.0005) b.position.z = 0;
      if (open && Math.abs(b.position.y) < 0.0005) b.position.y = 0;
      if (open && Math.abs(b.rotation.x) < 0.0005) b.rotation.set(0, 0, 0);
    }

    // 카메라: 펼친 하트(또는 모바일은 한쪽 페이지)가 화면에 꽉 차도록
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const usableH = (size.height - topInset) / size.height;
    let cx: number, needW: number, needH: number;
    if (!open) {
      cx = CX;
      needW = PAGE_W * 1.7;
      needH = PAGE_H * 1.65;
    } else {
      cx = focus === "both" ? 0 : focus === "left" ? -CX : CX;
      needW = focus === "both" ? (CX + PAGE_W / 2) * 2 * 1.06 : PAGE_W * 1.08;
      needH = PAGE_H * 1.08;
    }
    const dist = Math.max(needW / (2 * tanH * aspect), needH / (2 * tanH * usableH));
    // 위쪽 메뉴바만큼 하트를 아래로 내려 보이게 카메라 y를 올린다
    const cy = ((topInset / size.height) * 2 * tanH * dist) / 2;
    const kc = Math.min(1, d * 3.2);
    const p = cam.position;
    p.x += (cx - p.x) * kc;
    p.y += (cy - p.y) * kc;
    p.z += (dist + PAGE_Z - p.z) * kc;
    if (Math.abs(cx - p.x) + Math.abs(dist + PAGE_Z - p.z) < 0.001) p.set(cx, cy, dist + PAGE_Z);
    cam.lookAt(p.x, p.y, 0);

    // 책장 넘김
    const fs = flipState.current;
    const fr = flipRef.current;
    if (fr) {
      if (fs) {
        fs.t = Math.min(1, fs.t + d / (reducedMotion ? 0.2 : 0.62));
        const e = fs.t < 0.5 ? 2 * fs.t * fs.t : 1 - Math.pow(-2 * fs.t + 2, 2) / 2;
        fr.visible = true;
        fr.rotation.y = fs.dir === 1 ? -Math.PI * e : -Math.PI * (1 - e);
        fr.position.z = PAGE_Z + 0.004 + Math.sin(e * Math.PI) * 0.06;
        fr.scale.x = 1 - Math.sin(e * Math.PI) * 0.08;
        if (fs.t >= 1) flipState.current = null;
      } else fr.visible = false;
    }

    // 펼쳐진 뒤 HTML 편집 레이어가 얹힐 화면 좌표 계산
    const settled = open && angle.current === target && b && b.rotation.x === 0 && b.position.z === 0 && b.position.y === 0 && p.x === cx;
    if (!settled) {
      if (lastRects.current) {
        lastRects.current = "";
        onRects(null);
      }
      return;
    }
    const proj = (x: number, y: number) => {
      const v = new THREE.Vector3(x, y, PAGE_Z).project(cam);
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
    };
    const [rx0, ry0] = proj(CX - PAGE_W / 2, PAGE_H / 2);
    const [rx1, ry1] = proj(CX + PAGE_W / 2, -PAGE_H / 2);
    const [lx0] = proj(-CX - PAGE_W / 2, PAGE_H / 2);
    const right = { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 };
    const left = { x: lx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 };
    const key = [right.x, right.y, right.w, left.x].map((n) => Math.round(n)).join(",");
    if (key !== lastRects.current) {
      lastRects.current = key;
      onRects({ left, right });
    }
  });

  const ribbonColor = RIBBON_COLORS[settings.ribbon_key] ?? RIBBON_COLORS.rose;
  const [rbx, rby] = heartTo3D(0.5, 0.66);
  const [lkx, lky] = heartTo3D(0.955, 0.52);
  const [chx, chy] = heartTo3D(0.93, 0.1, 1.03);
  const ringYs = [0.44, 0.31, 0.18].map((v) => heartTo3D(0, v)[1]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <hemisphereLight args={["#fff5f7", "#e9b6c4", 0.3]} />
      <directionalLight
        position={[-3, 4, 6]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      <pointLight position={[3, 2, 3]} intensity={3} color="#ffd9e2" />

      <mesh position={[0, 0, -0.03]} material={mats.table} receiveShadow>
        <planeGeometry args={[30, 20]} />
      </mesh>

      <group ref={bookRef} position={[CX, 0, 0]}>
        <group
          position={[-CX, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            if (!open) onCoverClick();
          }}
          onPointerOver={() => !open && (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          {/* 뒤표지 */}
          <mesh geometry={geo.cover} material={mats.leather} castShadow receiveShadow />
          {/* 내지 묶음 (옆면 종이층) */}
          <mesh geometry={geo.block} material={[mats.paperSide, mats.paperSide]} position={[0, 0, COVER_T - 0.01]} castShadow receiveShadow />
          <mesh geometry={geo.paper} material={mats.paper} position={[0, 0, PAGE_Z + 0.001]} receiveShadow />

          {/* 링 제본 */}
          {ringYs.map((y, i) => (
            <mesh key={i} material={mats.gold} position={[0, y, PAGE_Z / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <torusGeometry args={[0.15, 0.02, 12, 40]} />
            </mesh>
          ))}

          {/* 앞표지: 힌지(x=0)를 축으로 회전 */}
          <group ref={coverRef} position={[0, 0, PAGE_Z + 0.005]}>
            <mesh geometry={geo.cover} material={mats.leather} castShadow receiveShadow />
            <mesh geometry={geo.decal} material={mats.decal} position={[0, 0.12, COVER_T + 0.009]} />
            <mesh geometry={geo.paper} material={mats.paper} position={[0, 0, -0.03]} />
            {geo.lace.map(([x, y], i) => (
              <mesh key={i} material={mats.lace} position={[x, y, COVER_T - 0.01]} castShadow>
                <sphereGeometry args={[0.035, 10, 8]} />
              </mesh>
            ))}
            <Ribbon color={ribbonColor} position={[rbx, rby, COVER_T + 0.06]} />
            <mesh material={mats.strap} position={[lkx - 0.04, lky, COVER_T + 0.01]} castShadow>
              <boxGeometry args={[0.32, 0.16, 0.03]} />
            </mesh>
            <mesh geometry={lockHeart} material={mats.gold} position={[lkx + 0.02, lky + 0.01, COVER_T + 0.025]} castShadow />
          </group>

          {/* 책장 넘김용 종이 */}
          <group ref={flipRef} position={[0, 0, PAGE_Z + 0.004]} visible={false}>
            <mesh geometry={geo.paper} material={mats.paper} castShadow />
          </group>

          {settings.chain_key !== "none" && (
            <group position={[chx, chy, PAGE_Z + 0.12]}>
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
      dpr={[1, 2]}
      camera={{ fov: 32, position: [CX, 0, 7], near: 0.1, far: 60 }}
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
