const assert = require("assert");
const { menorTerminadoEn999, formatearPesos, calcular } = require("./calculo.js");

function eq(actual, esperado, mensaje) {
  assert.strictEqual(actual, esperado, mensaje);
}

function redondeo(precioBase) {
  return Math.ceil((precioBase + 1) / 1000) * 1000 - 1;
}

function caso(datos) {
  return calcular({
    iibb: "5",
    iva: "9",
    cuotas: "8,9",
    ...datos,
  });
}

eq(Number(menorTerminadoEn999(16566n, 1n)), 16999);
eq(Number(menorTerminadoEn999(16999n, 1n)), 16999);
eq(Number(menorTerminadoEn999(17000n, 1n)), 17999);
for (const n of [16566, 16999, 17000, 999, 1000]) {
  eq(Number(menorTerminadoEn999(BigInt(n), 1n)), redondeo(n));
}

const ejemplo = caso({ neto: "12000", envio: "2000", comision: "13" });
eq(ejemplo.estado, "ok");
eq(ejemplo.sinCuotas.precio, 19999n);
eq(ejemplo.conCuotas.precio, 21999n);
eq(ejemplo.sinCuotas.neto >= ejemplo.sinCuotas.netoDeseado, true);
eq(ejemplo.conCuotas.neto >= ejemplo.conCuotas.netoDeseado, true);
eq(formatearPesos(ejemplo.sinCuotas.precio * 100n), "$19.999,00");
eq(formatearPesos(ejemplo.conCuotas.precio * 100n), "$21.999,00");

const exacto = caso({ neto: "12409,27", envio: "0", comision: "13" });
eq(exacto.sinCuotas.precio, 16999n);
eq(exacto.sinCuotas.diferencia, 0n);
eq(exacto.sinCuotas.neto, exacto.sinCuotas.netoDeseado);

const parcial = caso({ neto: "1000", envio: "0", comision: "80" });
eq(parcial.sinCuotas.ok, true);
eq(parcial.conCuotas.ok, false);
eq(parcial.conCuotas.codigo, "porcentajes");

const tope = caso({ neto: "1000", envio: "0", comision: "86" });
eq(tope.sinCuotas.ok, false);
eq(tope.conCuotas.ok, false);

eq(caso({ neto: "", envio: "1", comision: "1" }).estado, "incompleto");
eq(caso({ neto: "-1", envio: "1", comision: "1" }).estado, "error");

const porMonto = caso({
  modo: "costo",
  costo: "10000",
  ganancia: "3000",
  tipoGanancia: "monto",
  envio: "2000",
  comision: "13",
});
eq(porMonto.estado, "ok");
eq(porMonto.netoUsadoCentavos, 1300000n);
eq(porMonto.sinCuotas.precio, 20999n);

const porPorcentaje = caso({
  modo: "costo",
  costo: "10000",
  ganancia: "30",
  tipoGanancia: "porcentaje",
  envio: "2000",
  comision: "13",
});
eq(porPorcentaje.netoUsadoCentavos, 1300000n);
eq(porPorcentaje.sinCuotas.precio, porMonto.sinCuotas.precio);

const porcentajeDecimal = caso({
  modo: "costo",
  costo: "10000",
  ganancia: "8,5",
  tipoGanancia: "porcentaje",
  envio: "0",
  comision: "0",
  iibb: "0",
  iva: "0",
  cuotas: "0",
});
eq(porcentajeDecimal.netoUsadoCentavos, 1085000n);

const publicada = require("./calculo.js").gananciaPublicada({
  publicado: "19999",
  envio: "2000",
  comision: "13",
  iibb: "5",
  iva: "9",
  cuotas: "8,9",
});
eq(publicada.estado, "ok");
eq(publicada.sinCuotas.neto, 1259927n);
eq(publicada.conCuotas.neto, 1081936n);
eq(
  publicada.sinCuotas.comision +
    publicada.sinCuotas.iibb +
    publicada.sinCuotas.iva +
    publicada.sinCuotas.envio +
    publicada.sinCuotas.neto,
  publicada.sinCuotas.precioCentavos
);
eq(require("./calculo.js").gananciaPublicada({ publicado: "" }).estado, "oculto");
eq(require("./calculo.js").gananciaPublicada({ publicado: "-5", envio: "0", comision: "1", iibb: "5", iva: "9", cuotas: "8,9" }).estado, "error");

let semilla = 17;
function aleatorio() {
  semilla = (semilla * 1664525 + 1013904223) >>> 0;
  return semilla;
}

for (let i = 0; i < 200; i += 1) {
  const resultado = calcular({
    neto: String(aleatorio() % 400000),
    envio: String(aleatorio() % 80000),
    comision: ((aleatorio() % 4000) / 100).toFixed(2),
    iibb: ((aleatorio() % 800) / 100).toFixed(2),
    iva: ((aleatorio() % 1500) / 100).toFixed(2),
    cuotas: ((aleatorio() % 2000) / 100).toFixed(2),
  });
  eq(resultado.estado, "ok");
  for (const modalidad of [resultado.sinCuotas, resultado.conCuotas]) {
    if (!modalidad.ok) continue;
    eq(modalidad.precio % 1000n, 999n);
    eq(modalidad.precio * modalidad.baseDen >= modalidad.baseNum, true);
    eq((modalidad.precio - 1000n) * modalidad.baseDen < modalidad.baseNum, true);
    eq(modalidad.neto >= modalidad.netoDeseado, true);
    eq(modalidad.diferencia, modalidad.neto - modalidad.netoDeseado);
    eq(modalidad.ajustes, 0);
    eq(
      modalidad.comision + modalidad.iibb + modalidad.iva + modalidad.cuotas + modalidad.envio + modalidad.neto,
      modalidad.precio * 100n
    );
  }
}

console.log("OK");
