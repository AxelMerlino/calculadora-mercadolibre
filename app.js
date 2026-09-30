(function () {
  "use strict";

  const { calcular, formatearPesos } = window.CalculadoraPrecio;
  const CLAVE = "calculadora-mercadolibre-v1";
  const DEFAULTS = {
    neto: "",
    comision: "",
    envio: "",
    iibb: "5",
    iva: "9",
    cuotas: "8,9",
  };

  const MENSAJES = {
    invalido: "Ingresá un número. Podés usar coma o punto para los decimales.",
    negativo: "El valor no puede ser negativo.",
  };

  const form = document.getElementById("formulario");
  const resultados = document.getElementById("resultados");
  const estado = document.getElementById("estado");
  const cardSin = document.getElementById("card-sin");
  const cardCon = document.getElementById("card-con");
  const tasasResumen = document.getElementById("tasas-resumen");
  const barraSin = document.getElementById("barra-sin");
  const barraCon = document.getElementById("barra-con");
  const campos = Array.from(form.querySelectorAll("input"));

  function leer() {
    const datos = {};
    for (const input of campos) datos[input.name] = input.value;
    return datos;
  }

  function aplicar(datos) {
    const origen = { ...DEFAULTS, ...(datos || {}) };
    for (const input of campos) {
      if (Object.prototype.hasOwnProperty.call(origen, input.name)) {
        input.value = origen[input.name] == null ? "" : String(origen[input.name]);
      }
    }
  }

  function cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE) || "null");
      aplicar(guardado && typeof guardado === "object" ? guardado : DEFAULTS);
    } catch {
      aplicar(DEFAULTS);
    }
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(leer()));
    } catch {
      /* El cálculo sigue aunque el navegador bloquee el almacenamiento. */
    }
  }

  function pintarCampo(input, codigo) {
    const field = input.closest(".field");
    const msg = field.querySelector(".msg");
    field.classList.toggle("invalido", codigo === "invalido");
    field.classList.toggle("negativo", codigo === "negativo");
    input.setAttribute("aria-invalid", codigo === "invalido" || codigo === "negativo" ? "true" : "false");
    msg.textContent = MENSAJES[codigo] || "";
  }

  function fila(etiqueta, valor, clase) {
    const linea = document.createElement("div");
    linea.className = clase ? `fila ${clase}` : "fila";
    const nombre = document.createElement("span");
    nombre.textContent = etiqueta;
    const importe = document.createElement("span");
    importe.textContent = valor;
    linea.append(nombre, importe);
    return linea;
  }

  function textoAdicional(centavos) {
    if (centavos > 0n) return `+ ${formatearPesos(centavos)}`;
    return formatearPesos(centavos);
  }

  function pintarModalidad(card, modalidad, tipo, porcentajes) {
    card.replaceChildren();
    const titulo = tipo === "con" ? "Con cuotas" : "Sin cuotas";

    if (!modalidad.ok) {
      const caja = document.createElement("div");
      caja.className = "error-card";
      const h = document.createElement("h2");
      h.textContent = titulo;
      const p = document.createElement("p");
      if (modalidad.codigo === "porcentajes") {
        const detalle =
          tipo === "con"
            ? "comisión, IIBB, IVA y recargo por cuotas"
            : "comisión, IIBB e IVA";
        p.textContent = `No se puede calcular esta modalidad: la suma de ${detalle} es ${modalidad.sumaTexto} y tiene que ser menor que 100%.`;
      } else {
        p.textContent = "No se pudo asegurar el importe neto solicitado con estos datos.";
      }
      caja.append(h, p);
      card.append(caja);
      return;
    }

    const cabeza = document.createElement("div");
    const kicker = document.createElement("h2");
    kicker.className = "kicker";
    kicker.textContent = titulo;
    const filaPrecio = document.createElement("div");
    filaPrecio.className = "precio-row";
    const precio = document.createElement("p");
    precio.className = "precio";
    precio.textContent = formatearPesos(modalidad.precio * 100n);
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-copiar";
    boton.dataset.copiar = modalidad.precio.toString();
    boton.textContent = "Copiar";
    filaPrecio.append(precio, boton);
    const caption = document.createElement("p");
    caption.className = "caption";
    caption.textContent = "Menor precio terminado en 999 que cubre el cálculo.";
    cabeza.append(kicker, filaPrecio, caption);

    const desglose = document.createElement("div");
    desglose.className = "desglose";
    desglose.append(
      fila("Precio de publicación", formatearPesos(modalidad.precio * 100n)),
      fila(`Comisión de venta (${porcentajes.comision})`, formatearPesos(modalidad.comision)),
      fila(`IIBB (${porcentajes.iibb})`, formatearPesos(modalidad.iibb)),
      fila(`IVA (${porcentajes.iva})`, formatearPesos(modalidad.iva))
    );
    if (tipo === "con") {
      desglose.append(
        fila(`Recargo por cuotas (${porcentajes.cuotas})`, formatearPesos(modalidad.cuotas))
      );
    }
    desglose.append(
      fila("Costo del envío", formatearPesos(modalidad.envio)),
      fila("Importe neto final", formatearPesos(modalidad.neto), "real"),
      fila("Diferencia por el redondeo", textoAdicional(modalidad.diferencia), "extra")
    );

    card.append(cabeza, desglose);
  }

  function textoBarra(modalidad) {
    if (!modalidad) return "—";
    if (!modalidad.ok) return "Error";
    return formatearPesos(modalidad.precio * 100n);
  }

  function pintarTasas(tasas) {
    tasasResumen.replaceChildren();
    if (!tasas) return;
    const items = [
      ["Sin cuotas", tasas.sin],
      ["Con cuotas", tasas.con],
    ];
    for (const [nombre, info] of items) {
      const chip = document.createElement("p");
      chip.className = info.excesiva ? "chip excesiva" : "chip";
      chip.textContent = info.excesiva
        ? `${nombre}: ${info.texto} (llega o supera el 100%)`
        : `${nombre}: ${info.texto} del precio`;
      tasasResumen.append(chip);
    }
  }

  function porcentajesIngresados() {
    const { formatearPorcentaje, parseNumero } = window.CalculadoraPrecio;
    const salida = {};
    for (const clave of ["comision", "iibb", "iva", "cuotas"]) {
      const parsed = parseNumero(leer()[clave]);
      salida[clave] =
        parsed.estado === "ok" ? formatearPorcentaje(parsed.num, parsed.den * 100n) : "";
    }
    return salida;
  }

  function render() {
    const datos = leer();
    guardar();
    for (const input of campos) {
      pintarCampo(input, null);
    }

    const resultado = calcular(datos);
    pintarTasas(resultado.tasas);

    for (const input of campos) {
      pintarCampo(input, resultado.errores[input.name]);
    }

    if (resultado.estado !== "ok") {
      cardSin.hidden = true;
      cardCon.hidden = true;
      estado.hidden = false;
      estado.replaceChildren();
      const titulo = document.createElement("h2");
      const texto = document.createElement("p");
      if (resultado.estado === "incompleto") {
        titulo.textContent = "Faltan datos";
        texto.textContent = "Completá el importe neto, la comisión y el envío para ver los precios. IIBB, IVA y el recargo por cuotas también tienen que tener un valor.";
      } else {
        titulo.textContent = "Revisá los datos";
        texto.textContent = "Corregí los campos marcados. Los importes y porcentajes tienen que ser números iguales o mayores que cero.";
      }
      estado.append(titulo, texto);
      barraSin.textContent = "—";
      barraCon.textContent = "—";
      return;
    }

    const porcentajes = porcentajesIngresados();
    estado.hidden = true;
    cardSin.hidden = false;
    cardCon.hidden = false;
    pintarModalidad(cardSin, resultado.sinCuotas, "sin", porcentajes);
    pintarModalidad(cardCon, resultado.conCuotas, "con", porcentajes);
    barraSin.textContent = textoBarra(resultado.sinCuotas);
    barraCon.textContent = textoBarra(resultado.conCuotas);
  }

  function copiarEnElActo(texto) {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.fontSize = "16px";
    area.style.opacity = "0";
    document.body.append(area);
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, texto.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    window.scrollTo(scrollX, scrollY);
    return ok;
  }

  async function copiar(texto) {
    if (copiarEnElActo(texto)) return true;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch {
      /* El primer intento ya cubre la mayoría de los navegadores. */
    }
    return false;
  }

  resultados.addEventListener("click", async (evento) => {
    const boton = evento.target.closest("[data-copiar]");
    if (!boton) return;
    const ok = await copiar(boton.dataset.copiar);
    boton.textContent = ok ? "Copiado" : "No se pudo copiar";
    boton.classList.toggle("copiado", ok);
    window.setTimeout(() => {
      if (!boton.isConnected) return;
      boton.textContent = "Copiar";
      boton.classList.remove("copiado");
    }, 1600);
  });

  form.addEventListener("input", render);
  form.addEventListener("submit", (evento) => evento.preventDefault());
  form.addEventListener("focusin", (evento) => {
    if (evento.target.tagName === "INPUT") document.body.classList.add("ocultar-barra");
  });
  form.addEventListener("focusout", (evento) => {
    const siguiente = evento.relatedTarget;
    if (siguiente && siguiente.tagName === "INPUT" && form.contains(siguiente)) return;
    document.body.classList.remove("ocultar-barra");
  });

  document.getElementById("restablecer").addEventListener("click", () => {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* igual se vacían los campos en pantalla */
    }
    aplicar(DEFAULTS);
    render();
  });

  document.getElementById("ir-sin").addEventListener("click", () => {
    cardSin.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("ir-con").addEventListener("click", () => {
    cardCon.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  cargar();
  render();
})();
