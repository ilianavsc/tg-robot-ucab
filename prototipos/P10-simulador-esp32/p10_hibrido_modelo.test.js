/* Pruebas del escenario híbrido de P10 (SIL) y comprobación de sintaxis del HTML.
 * Uso:  node prototipos/P10-simulador-esp32/p10_hibrido_modelo.test.js
 * No necesita navegador ni dependencias. */
"use strict";
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const M = require("./p10_hibrido_modelo.js");

let ok = 0;
function prueba(nombre, f) {
  f();
  ok++;
  console.log("  OK   " + nombre);
}
function correr(e, s, alPaso) {
  for (let i = 0; i < Math.round(s / 0.05); i++) {
    M.avanzar(e, 0.05);
    if (alPaso) alPaso(e);
  }
}

prueba("el RSSI va de -80 dBm (lejos) a -52 dBm (cerca) y crece al acercarse", () => {
  assert.strictEqual(M.rssi(20), -80);
  assert.strictEqual(M.rssi(M.C.RADIO_DETECCION_M), -80);
  assert.strictEqual(M.rssi(0.2), -52);
  let previo = -81;
  for (let d = 7; d >= 0; d -= 0.1) {
    const r = M.rssi(d);
    assert.ok(r >= -80 && r <= -52, "fuera de rango: " + r);
    assert.ok(r >= previo - 1e-9, "no creciente al acercarse");
    previo = r;
  }
});

prueba("con cinta [0,1,1,0]; sin cinta [0,0,0,0] solo en el tramo intermedio", () => {
  const e = M.iniciar(M.crear());
  assert.deepStrictEqual(M.tcrt(e), [0, 1, 1, 0]);
  let vioSin = false, sinDespuesDeConfirmar = false;
  correr(e, 40, (x) => {
    const t = M.tcrt(x);
    if (x.fase === "sin-cinta") {
      assert.deepStrictEqual(t, [0, 0, 0, 0]);
      assert.ok(x.s >= M.C.INICIO_SIN_CINTA_M);
      vioSin = true;
    }
    if (x.confirmada && t.join() === "0,0,0,0") sinDespuesDeConfirmar = true;
  });
  assert.ok(vioSin);
  assert.ok(!sinDespuesDeConfirmar, "al confirmar la baliza vuelve la cinta");
  assert.strictEqual(e.fase, "completo");
  assert.deepStrictEqual(M.tcrt(e), [0, 1, 1, 0]);
});

prueba("el robot no avanza ni confirma si el escenario no está activo", () => {
  const e = M.crear();
  correr(e, 5);
  assert.strictEqual(e.s, 0);
  assert.strictEqual(e.fase, "inactivo");
  assert.deepStrictEqual(M.tcrt(e), [0, 1, 1, 0]);
});

prueba("las balizas: el RSSI del Cuarto baja al alejarse y el del Laboratorio 1 sube al llegar", () => {
  const e = M.iniciar(M.crear());
  const rl = [], rc = [];
  let ultimaLectura = -1;
  correr(e, 30, (x) => {
    if (x.lecturas !== ultimaLectura) {
      ultimaLectura = x.lecturas;
      rl.push(x.rssiLab);
      rc.push(x.rssiCuarto);
    }
  });
  const media = (a, i, j) => a.slice(i, j).reduce((s, v) => s + v, 0) / (j - i);
  assert.ok(media(rc, 0, 5) > media(rc, 40, 45), "el Cuarto se oye más al salir que a mitad de camino");
  assert.ok(media(rl, rl.length - 10, rl.length - 5) > media(rl, 10, 15) + 10, "el Laboratorio 1 se oye mucho más al llegar");
  assert.ok(Math.min(...rl) >= -81.01 && Math.max(...rl) <= -50.9, "rango -80…-52 dBm (± rizado de 1 dBm)");
});

prueba("la confirmación exige 3 lecturas seguidas ≥ -55 dBm (el contador sube de 1 en 1 y se reinicia)", () => {
  const e = M.iniciar(M.crear());
  let previo = 0, subidas = 0, reinicios = 0, sConfirma = null;
  let ultimaLectura = -1;
  correr(e, 40, (x) => {
    if (x.lecturas === ultimaLectura) return;
    ultimaLectura = x.lecturas;
    if (x.confirmaciones === previo + 1) subidas++;
    else if (x.confirmaciones === 0 && previo > 0) reinicios++;
    else assert.strictEqual(x.confirmaciones, previo, "salto raro del contador");
    previo = x.confirmaciones;
    if (x.confirmada && sConfirma === null) sConfirma = x.s;
  });
  assert.ok(subidas >= M.C.LECTURAS_CONFIRMACION, "subió al menos 3 veces");
  assert.ok(sConfirma !== null, "confirmó");
  assert.ok(sConfirma > M.C.LONGITUD_M - 1.5, "solo confirma a menos de ~1 m de la baliza (s=" + sConfirma + ")");
  assert.strictEqual(e.confirmaciones >= M.C.LECTURAS_CONFIRMACION, true);
});

prueba("heading hold: el desvío relativo se mantiene < 0,5° y la deriva con hold es mucho menor que sin hold", () => {
  const e = M.iniciar(M.crear());
  let maxErr = 0;
  correr(e, 40, (x) => { if (Math.abs(x.headingErrDeg) > maxErr) maxErr = Math.abs(x.headingErrDeg); });
  assert.ok(maxErr < 0.5, "desvío con hold: " + maxErr);
  assert.ok(e.errSinHoldDeg > 3, "sin hold el giroscopio se iría > 3°");
  assert.ok(e.derivaHoldCm * 5 < e.derivaSinHoldCm, "con hold " + e.derivaHoldCm + " cm vs sin hold " + e.derivaSinHoldCm + " cm");
  assert.ok(e.derivaHoldCm < 10);
});

prueba("el modelo es determinista (sin Math.random)", () => {
  const a = M.iniciar(M.crear()), b = M.iniciar(M.crear());
  correr(a, 25); correr(b, 25);
  assert.deepStrictEqual(a, b);
  assert.ok(!/Math\.random/.test(fs.readFileSync(path.join(__dirname, "p10_hibrido_modelo.js"), "utf8")));
});

/* ---- index.html: sintaxis del script en línea y elementos que usa el escenario ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const bloques = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

prueba("el script en línea de index.html compila sin errores de sintaxis", () => {
  assert.ok(bloques.length >= 1);
  bloques.forEach((b) => new vm.Script(b));
});

prueba("index.html carga el modelo y trae el panel híbrido con todos sus elementos", () => {
  assert.ok(html.includes('<script src="p10_hibrido_modelo.js"></script>'));
  for (const id of ["panel-hibrido", "btn-hibrido", "btn-hibrido-reiniciar", "hib-fase", "hib-tcrt", "hib-heading",
    "hib-deriva", "hib-rssi-cuarto", "hib-rssi-lab", "hib-confirma", "hib-avance"]) {
    assert.ok(html.includes('id="' + id + '"'), "falta #" + id);
  }
  assert.ok(html.includes("PENDIENTE DE INTEGRACIÓN EN FIRMWARE"));
  assert.ok(!/magnet[oó]metro:\s*true/i.test(html));
});

prueba("los botones del panel SIL clásico usan data-sil y el híbrido no los confunde", () => {
  assert.ok(html.includes('document.querySelectorAll(".btn-sil[data-sil]")'));
});

console.log("\nResultado: " + ok + " pruebas OK");
