(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CalculadoraPrecio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CAMPOS = ["neto", "envio", "comision", "iibb", "iva", "cuotas"];

  function gcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a === 0n ? 1n : a;
  }

  function reducir(num, den) {
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    const g = gcd(num, den);
    return { num: num / g, den: den / g };
  }

  function divEnteraHaciaArriba(numerador, denominador) {
    return (numerador + denominador - 1n) / denominador;
  }

  function divRedondeoMedioHaciaArriba(numerador, denominador) {
    const negativo = numerador < 0n;
    const abs = negativo ? -numerador : numerador;
    const cociente = (abs + denominador / 2n) / denominador;
    return negativo ? -cociente : cociente;
  }

  function aCentavos(num, den) {
    return divRedondeoMedioHaciaArriba(num * 100n, den);
  }

  /**
   * Menor entero terminado en 999 que es mayor o igual que num/den.
   * Equivale a Math.ceil((precioBase + 1) / 1000) * 1000 - 1,
   * pero con enteros: un base exacto de 16999 no salta a 17999.
   */
  function menorTerminadoEn999(num, den) {
    if (den <= 0n) {
      throw new Error("Denominador inválido");
    }
    if (num < 0n) num = 0n;
    const fraccion = reducir(num, den);
    const a = fraccion.num + fraccion.den;
    const b = fraccion.den * 1000n;
    const k = divEnteraHaciaArriba(a, b);
    const precio = k * 1000n - 1n;
    return precio < 999n ? 999n : precio;
  }

  function parseNumero(texto) {
    if (texto == null) return { estado: "vacio" };
    let s = String(texto).trim();
    if (s === "") return { estado: "vacio" };

    s = s.replace(/\s/g, "").replace(/\$/g, "").replace(/%/g, "");
    if (s === "" || s === "," || s === "." || s === "+" || s === "-") {
      return s === "-" ? { estado: "negativo" } : { estado: "vacio" };
    }

    let negativo = false;
    if (s[0] === "+" || s[0] === "-") {
      negativo = s[0] === "-";
      s = s.slice(1);
    }
    if (s === "" || s === "," || s === ".") return { estado: "vacio" };

    const comas = (s.match(/,/g) || []).length;
    const puntos = (s.match(/\./g) || []).length;

    if (comas > 1 && puntos === 0) {
      s = s.replace(/,/g, "");
    } else if (comas > 0 && puntos > 0) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (comas === 1) {
      s = s.replace(",", ".");
    } else if (puntos > 1) {
      s = s.replace(/\./g, "");
    }

    if (s.endsWith(".")) s = s.slice(0, -1);
    if (!/^\d+(\.\d+)?$/.test(s)) return { estado: "invalido" };

    const partes = s.split(".");
    const entero = partes[0];
    const frac = partes[1] || "";
    if (entero.length > 15 || frac.length > 6) return { estado: "invalido" };

    const digits = `${entero}${frac}`.replace(/^0+(?=\d)/, "") || "0";
    const num = BigInt(digits);
    const den = 10n ** BigInt(frac.length);
    if (negativo && num !== 0n) {
      return { estado: "negativo", ...reducir(num, den) };
    }
    return { estado: "ok", ...reducir(num, den) };
  }

  function tasaDesdePorcentaje(valor) {
    return reducir(valor.num, valor.den * 100n);
  }

  function sumarTasas(tasas) {
    let num = 0n;
    let den = 1n;
    for (const tasa of tasas) {
      num = num * tasa.den + tasa.num * den;
      den = den * tasa.den;
      const g = gcd(num, den);
      num /= g;
      den /= g;
    }
    return { num, den };
  }

  function formatearPesos(centavos) {
    const negativo = centavos < 0n;
    const abs = negativo ? -centavos : centavos;
    const entero = (abs / 100n).toString();
    const dec = (abs % 100n).toString().padStart(2, "0");
    const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${negativo ? "-" : ""}$${conMiles},${dec}`;
  }

  function formatearPorcentaje(num, den) {
    const escala = 4n;
    const scaled = divRedondeoMedioHaciaArriba(num * 100n * 10n ** escala, den);
    const negativo = scaled < 0n;
    const abs = negativo ? -scaled : scaled;
    const factor = 10n ** escala;
    const entero = (abs / factor).toString();
    const frac = (abs % factor).toString().padStart(4, "0").replace(/0+$/, "");
    return `${negativo ? "-" : ""}${frac ? `${entero},${frac}` : entero}%`;
  }

  function resumenTasa(suma) {
    return {
      texto: formatearPorcentaje(suma.num, suma.den),
      excesiva: suma.num >= suma.den && suma.den > 0n,
    };
  }

  function netoRacional(precio, restante, envio) {
    return reducir(
      precio * restante.num * envio.den - envio.num * restante.den,
      restante.den * envio.den
    );
  }

  function sumarDos(a, b) {
    return reducir(a.num * b.den + b.num * a.den, a.den * b.den);
  }

  function detallePorcentaje(precio, tasa) {
    const numerador = precio * 100n * tasa.num;
    const den = tasa.den;
    const resto = den === 0n ? 0n : numerador % den;
    const cents = den === 0n ? 0n : resto * 2n >= den ? numerador / den + 1n : numerador / den;
    return { cents, resto, den, ajustable: tasa.num !== 0n };
  }

  function cuadrarPorcentajes(precio, neto, envio, lineas) {
    const cents = lineas.map((linea) => linea.cents);
    let diff = precio * 100n - neto - envio - cents.reduce((suma, valor) => suma + valor, 0n);
    if (diff === 0n) return cents;

    const indices = lineas
      .map((linea, indice) => ({ indice, ...linea }))
      .filter((linea) => {
        if (!linea.ajustable) return false;
        if (diff > 0n) return linea.resto * 2n < linea.den;
        return linea.resto * 2n >= linea.den && cents[linea.indice] > 0n;
      })
      .sort((a, b) => {
        const izquierda = a.resto * b.den;
        const derecha = b.resto * a.den;
        if (izquierda === derecha) return 0;
        if (diff > 0n) return izquierda > derecha ? -1 : 1;
        return izquierda < derecha ? -1 : 1;
      });

    for (const linea of indices) {
      if (diff === 0n) break;
      if (diff > 0n) {
        cents[linea.indice] += 1n;
        diff -= 1n;
      } else {
        cents[linea.indice] -= 1n;
        diff += 1n;
      }
    }

    if (diff !== 0n) cents[0] += diff;
    return cents;
  }

  function calcularModalidad(objetivo, tasas, envio, netoDeseado) {
    const suma = sumarTasas(tasas);
    if (suma.den <= 0n || suma.num >= suma.den) {
      return {
        ok: false,
        codigo: "porcentajes",
        sumaTexto: formatearPorcentaje(suma.num, suma.den),
      };
    }

    const restante = reducir(suma.den - suma.num, suma.den);
    const baseNum = objetivo.num * restante.den;
    const baseDen = objetivo.den * restante.num;
    let precio = menorTerminadoEn999(baseNum, baseDen);
    let ajustes = 0;

    function armar(precioActual) {
      const netoExacto = netoRacional(precioActual, restante, envio);
      const neto = aCentavos(netoExacto.num, netoExacto.den);
      const pedido = aCentavos(netoDeseado.num, netoDeseado.den);
      const envioCent = aCentavos(envio.num, envio.den);
      const detalles = tasas.map((tasa) => detallePorcentaje(precioActual, tasa));
      const [comision, iibb, iva, cuotas = 0n] = cuadrarPorcentajes(
        precioActual,
        neto,
        envioCent,
        detalles
      );

      return {
        ok: true,
        precio: precioActual,
        baseNum,
        baseDen,
        comision,
        iibb,
        iva,
        cuotas,
        envio: envioCent,
        neto,
        netoDeseado: pedido,
        diferencia: neto - pedido,
        ajustes,
      };
    }

    let resultado = armar(precio);
    while (resultado.neto < resultado.netoDeseado && ajustes < 8) {
      ajustes += 1;
      precio += 1000n;
      resultado = armar(precio);
    }

    if (resultado.neto < resultado.netoDeseado) {
      return { ok: false, codigo: "neto", sumaTexto: formatearPorcentaje(suma.num, suma.den) };
    }

    return resultado;
  }

  function leerTasas(valores) {
    const claves = ["comision", "iibb", "iva", "cuotas"];
    for (const clave of claves) {
      if (!valores[clave] || valores[clave].estado !== "ok") return null;
    }
    const comision = tasaDesdePorcentaje(valores.comision);
    const iibb = tasaDesdePorcentaje(valores.iibb);
    const iva = tasaDesdePorcentaje(valores.iva);
    const cuotas = tasaDesdePorcentaje(valores.cuotas);
    return {
      sin: resumenTasa(sumarTasas([comision, iibb, iva])),
      con: resumenTasa(sumarTasas([comision, iibb, iva, cuotas])),
      lista: { comision, iibb, iva, cuotas },
    };
  }

  function calcular(entradas) {
    const errores = {};
    const valores = {};
    let hayVacio = false;
    let hayError = false;

    for (const campo of CAMPOS) {
      const parsed = parseNumero(entradas ? entradas[campo] : "");
      errores[campo] = parsed.estado === "ok" ? null : parsed.estado;
      if (parsed.estado === "vacio") hayVacio = true;
      if (parsed.estado === "invalido" || parsed.estado === "negativo") hayError = true;
      valores[campo] = parsed;
    }

    const tasas = leerTasas(valores);

    if (hayVacio || hayError) {
      return {
        estado: hayError ? "error" : "incompleto",
        errores,
        tasas,
        sinCuotas: null,
        conCuotas: null,
      };
    }

    const objetivo = sumarDos(valores.neto, valores.envio);
    const { comision, iibb, iva, cuotas } = tasas.lista;

    return {
      estado: "ok",
      errores,
      tasas,
      sinCuotas: calcularModalidad(objetivo, [comision, iibb, iva], valores.envio, valores.neto),
      conCuotas: calcularModalidad(
        objetivo,
        [comision, iibb, iva, cuotas],
        valores.envio,
        valores.neto
      ),
    };
  }

  return {
    CAMPOS,
    parseNumero,
    menorTerminadoEn999,
    formatearPesos,
    formatearPorcentaje,
    calcular,
  };
});
