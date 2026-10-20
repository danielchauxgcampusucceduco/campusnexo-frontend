import { useEffect, useRef } from 'react';
import { DESK_ABANDON_MINUTES } from '../../domain/desks';
import { boxCenter, polygonCentroid } from '../../domain/geometry';
import type { DeskObservation, StudyZoneRoi, TrackedDetection } from '../../domain/model';
import type { TwinGateway } from '../../ports/TwinGateway';
import { DESK_META, OBJECT_META } from '../theme';

interface Props {
  gateway: TwinGateway;
  spaceId: string;
  rois: StudyZoneRoi[];
  desks: DeskObservation[];
  now: number;
  privacyBlur: boolean;
  showBoxes: boolean;
}

const ASPECT = 16 / 9;
const NIGHT = '#0f1d24';
const LINE = '#2a4350';
const PIXEL_BLOCK = 9;

/**
 * Top-down camera viewport rendered at the display refresh rate. Each animation frame reads a live
 * sample from the gateway (outside React state) and draws: the floor plan, desk ROIs coloured by
 * their anti-hoarding state with the 15-minute countdown, the scene (optionally pixelated for privacy)
 * and the YOLO/ByteTrack boxes.
 */
export function CameraCanvas({ gateway, spaceId, rois, desks, now, privacyBlur, showBoxes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ rois, desks, now, privacyBlur, showBoxes, nowReceivedAt: performance.now() });
  live.current = { rois, desks, now, privacyBlur, showBoxes, nowReceivedAt: live.current.now === now ? live.current.nowReceivedAt : performance.now() };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const scene = document.createElement('canvas');
    const mosaic = document.createElement('canvas');
    const noise = document.createElement('canvas');
    noise.width = 160;
    noise.height = 90;
    let frame = 0;
    let fpsCount = 0;
    let fpsStamp = performance.now();
    let fps = 0;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round((width / ASPECT) * ratio);
      scene.width = canvas.width;
      scene.height = canvas.height;
      mosaic.width = Math.max(1, Math.round(canvas.width / PIXEL_BLOCK));
      mosaic.height = Math.max(1, Math.round(canvas.height / PIXEL_BLOCK));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (time: number) => {
      const W = canvas.width;
      const H = canvas.height;
      const s = W / 1000;
      const { rois: zones, desks: deskStates, privacyBlur: blur, showBoxes: boxes } = live.current;
      const sample = gateway.sampleCamera(spaceId, time);
      const detections = sample?.detections ?? [];
      const online = sample?.cameraOnline ?? false;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = NIGHT;
      context.fillRect(0, 0, W, H);
      drawFloor(context, W, H, s, zones.length > 0);

      for (const zone of zones) {
        drawRoi(context, zone, deskStates.find((d) => d.zoneId === zone.zoneId), W, H, s, live.current.now + (performance.now() - live.current.nowReceivedAt) * gateway.timeScale());
      }

      if (online) {
        const sceneContext = scene.getContext('2d')!;
        sceneContext.clearRect(0, 0, W, H);
        for (const detection of detections) drawObject(sceneContext, detection, W, H, s);
        if (blur) {
          const mosaicContext = mosaic.getContext('2d')!;
          mosaicContext.imageSmoothingEnabled = true;
          mosaicContext.clearRect(0, 0, mosaic.width, mosaic.height);
          mosaicContext.drawImage(scene, 0, 0, mosaic.width, mosaic.height);
          context.imageSmoothingEnabled = false;
          context.drawImage(mosaic, 0, 0, W, H);
          context.imageSmoothingEnabled = true;
        } else {
          context.drawImage(scene, 0, 0);
        }
        if (boxes) for (const detection of detections) drawBox(context, detection, W, H, s, !blur);
      } else {
        drawNoSignal(context, noise, W, H, s, time);
      }

      fpsCount++;
      if (time - fpsStamp >= 1000) {
        fps = fpsCount;
        fpsCount = 0;
        fpsStamp = time;
      }
      drawHud(context, W, s, spaceId, online, detections, fps, blur);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [gateway, spaceId]);

  return (
    <canvas
      ref={canvasRef}
      className="block aspect-video w-full rounded-xl bg-night"
      role="img"
      aria-label={`Vista cenital de la cámara de ${spaceId} con detecciones YOLO y regiones de puestos`}
    />
  );
}

function drawFloor(ctx: CanvasRenderingContext2D, W: number, H: number, s: number, library: boolean) {
  ctx.strokeStyle = 'rgba(95,208,191,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40 * s) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40 * s) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3 * s;
  ctx.strokeRect(6 * s, 6 * s, W - 12 * s, H - 12 * s);
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, H * 0.42, 14 * s, H * 0.16);
  ctx.fillStyle = 'rgba(207,224,220,0.45)';
  ctx.font = `${11 * s}px 'Archivo Variable', sans-serif`;
  ctx.fillText('Acceso', 18 * s, H * 0.5 + 4 * s);
  if (library) {
    ctx.fillStyle = 'rgba(207,224,220,0.32)';
    ctx.fillText('Pasillo de circulación', W * 0.42, H * 0.335);
  } else {
    ctx.strokeStyle = 'rgba(207,224,220,0.22)';
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(W * 0.35, H * 0.05, W * 0.3, H * 0.05);
    ctx.fillStyle = 'rgba(207,224,220,0.35)';
    ctx.fillText('Tablero', W * 0.47, H * 0.04);
  }
}

function drawRoi(ctx: CanvasRenderingContext2D, zone: StudyZoneRoi, desk: DeskObservation | undefined, W: number, H: number, s: number, now: number) {
  const state = desk?.state ?? 'DISPONIBLE';
  const color = DESK_META[state].color;
  ctx.beginPath();
  zone.polygon.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x * W, y * H) : ctx.lineTo(x * W, y * H)));
  ctx.closePath();
  ctx.fillStyle = `${color}22`;
  ctx.fill();
  ctx.setLineDash(state === 'DISPONIBLE' ? [6 * s, 5 * s] : []);
  ctx.lineWidth = 2 * s;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.setLineDash([]);

  const xs = zone.polygon.map(([x]) => x * W);
  const ys = zone.polygon.map(([, y]) => y * H);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  ctx.fillStyle = color;
  ctx.font = `600 ${12 * s}px 'Archivo Variable', sans-serif`;
  ctx.fillText(zone.label, left + 8 * s, Math.max(...ys) - 8 * s);

  if (desk?.unattendedSince && state === 'ALERTA_ACAPARAMIENTO') {
    const elapsedMinutes = Math.max(0, (now - Date.parse(desk.unattendedSince)) / 60_000);
    const remaining = Math.max(0, DESK_ABANDON_MINUTES - elapsedMinutes);
    const [cx, cy] = polygonCentroid(zone.polygon);
    const radius = 20 * s;
    const x = cx * W - 46 * s;
    const y = cy * H;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(224,165,49,0.25)';
    ctx.lineWidth = 4 * s;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (remaining / DESK_ABANDON_MINUTES));
    ctx.strokeStyle = color;
    ctx.stroke();
    const minutes = Math.floor(remaining);
    const seconds = Math.floor((remaining - minutes) * 60);
    ctx.fillStyle = '#f5e6c4';
    ctx.font = `600 ${10.5 * s}px 'Archivo Variable', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, x, y + 4 * s);
    ctx.textAlign = 'left';
  }
  if (state === 'LIBERADO_POR_ABANDONO') {
    ctx.fillStyle = color;
    ctx.font = `${10.5 * s}px 'Archivo Variable', sans-serif`;
    ctx.fillText('Puesto liberado', left + 8 * s, top + 32 * s);
  }
}

/** Top view of the scene: shoulders and head for people, simple shapes for belongings. */
function drawObject(ctx: CanvasRenderingContext2D, detection: TrackedDetection, W: number, H: number, s: number) {
  const [cx, cy] = boxCenter(detection.box);
  const x = cx * W;
  const y = cy * H;
  switch (detection.objectClass) {
    case 'PERSON': {
      ctx.fillStyle = '#486f7d';
      ctx.beginPath();
      ctx.ellipse(x, y + 6 * s, 17 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9a98c';
      ctx.beginPath();
      ctx.arc(x, y - 4 * s, 8.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f2a26';
      ctx.beginPath();
      ctx.arc(x, y - 6 * s, 7.5 * s, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'LAPTOP':
      ctx.fillStyle = '#9fb3bb';
      ctx.fillRect(x - 15 * s, y - 9 * s, 30 * s, 18 * s);
      ctx.fillStyle = '#5c7580';
      ctx.fillRect(x - 13 * s, y - 7 * s, 26 * s, 11 * s);
      break;
    case 'BACKPACK':
      ctx.fillStyle = '#b35f3f';
      ctx.beginPath();
      ctx.roundRect(x - 11 * s, y - 13 * s, 22 * s, 26 * s, 7 * s);
      ctx.fill();
      break;
    case 'BOOK':
      ctx.fillStyle = '#8f7bbd';
      ctx.fillRect(x - 10 * s, y - 7 * s, 20 * s, 14 * s);
      break;
  }
}

/** Tactical corner brackets with the track id and confidence. */
function drawBox(ctx: CanvasRenderingContext2D, detection: TrackedDetection, W: number, H: number, s: number, showId: boolean) {
  const meta = OBJECT_META[detection.objectClass];
  const { xMin, yMin, xMax, yMax } = detection.box;
  const x0 = xMin * W;
  const y0 = yMin * H;
  const x1 = xMax * W;
  const y1 = yMax * H;
  const corner = Math.min(10 * s, (x1 - x0) / 3);
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + corner); ctx.lineTo(x0, y0); ctx.lineTo(x0 + corner, y0);
  ctx.moveTo(x1 - corner, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + corner);
  ctx.moveTo(x1, y1 - corner); ctx.lineTo(x1, y1); ctx.lineTo(x1 - corner, y1);
  ctx.moveTo(x0 + corner, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - corner);
  ctx.stroke();
  const label = showId ? `${meta.label} #${detection.trackId} ${Math.round(detection.confidence * 100)}%` : meta.label;
  ctx.font = `600 ${9.5 * s}px 'Archivo Variable', sans-serif`;
  const width = ctx.measureText(label).width + 8 * s;
  ctx.fillStyle = `${meta.color}e6`;
  ctx.fillRect(x0, y0 - 14 * s, width, 13 * s);
  ctx.fillStyle = '#0f1d24';
  ctx.fillText(label, x0 + 4 * s, y0 - 4 * s);
}

function drawNoSignal(ctx: CanvasRenderingContext2D, noise: HTMLCanvasElement, W: number, H: number, s: number, time: number) {
  const noiseContext = noise.getContext('2d')!;
  const image = noiseContext.createImageData(noise.width, noise.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.random() * 90;
    image.data[i] = value * 0.7;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 150;
  }
  noiseContext.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  const pulse = 0.75 + 0.25 * Math.sin(time / 300);
  ctx.fillStyle = `rgba(15,29,36,${0.82})`;
  ctx.fillRect(W * 0.2, H * 0.38, W * 0.6, H * 0.24);
  ctx.fillStyle = `rgba(224,102,79,${pulse})`;
  ctx.font = `700 ${22 * s}px 'Archivo Variable', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Sin señal de la cámara', W / 2, H * 0.48);
  ctx.fillStyle = '#cfe0dc';
  ctx.font = `${13 * s}px 'Archivo Variable', sans-serif`;
  ctx.fillText('El filtro de Kalman sigue estimando con CO₂ y Wi-Fi', W / 2, H * 0.55);
  ctx.textAlign = 'left';
}

function drawHud(ctx: CanvasRenderingContext2D, W: number, s: number, spaceId: string, online: boolean, detections: TrackedDetection[], fps: number, blur: boolean) {
  const people = detections.filter((d) => d.objectClass === 'PERSON').length;
  const objects = detections.length - people;
  const title = `${spaceId} · cámara con IA`;
  const counts = online ? `${people} personas, ${objects} objetos` : 'cámara caída';
  ctx.font = `600 ${13 * s}px 'Archivo Variable', sans-serif`;
  const titleWidth = ctx.measureText(title).width;
  ctx.font = `${13 * s}px 'Archivo Variable', sans-serif`;
  const countsWidth = ctx.measureText(counts).width;
  ctx.fillStyle = 'rgba(15,29,36,0.82)';
  ctx.fillRect(14 * s, 14 * s, 44 * s + titleWidth + countsWidth, 32 * s);
  ctx.fillStyle = online ? '#5fd0bf' : '#e0664f';
  ctx.beginPath();
  ctx.arc(29 * s, 30 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8f2ef';
  ctx.font = `600 ${13 * s}px 'Archivo Variable', sans-serif`;
  ctx.fillText(title, 42 * s, 35 * s);
  ctx.fillStyle = online ? '#cfe0dc' : '#f6a47f';
  ctx.font = `${13 * s}px 'Archivo Variable', sans-serif`;
  ctx.fillText(counts, 42 * s + titleWidth + 14 * s, 35 * s);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(207,224,220,0.8)';
  ctx.fillText(`${fps} FPS${blur ? ', privacidad activa' : ''}`, W - 18 * s, 34 * s);
  ctx.textAlign = 'left';
}
