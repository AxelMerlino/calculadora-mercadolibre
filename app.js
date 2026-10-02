(function () {
  "use strict";

  const { calcular, formatearPesos, gananciaPublicada } = window.CalculadoraPrecio;
  const CLAVE = "calculadora-mercadolibre-v1";
  const DEFAULTS = {
    modo: "costo",
    tipoGanancia: "monto",
    costo: "",
    ganancia: "",
    neto: "",
    comision: "",
    envio: "",
    iibb: "5",
    iva: "9",
    cuotas: "8,9",
    publicado: "",
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
  const cardGanancia = document.getElementById("card-ganancia");
  const tasasResumen = document.getElementById("tasas-resumen");
  const barraSin = document.getElementById("barra-sin");
  const barraCon = document.getElementById("barra-con");
  const campos = Array.from(form.querySelectorAll("input"));

  function leer() {
    const datos = {};
    for (const input of campos) {
      if (input.type === "radio") {
        if (input.checked) datos[input.name] = input.value;
      } else {
        datos[input.name] = input.value;
      }
    }
    return datos;
  }

  function aplicar(datos) {
    const origen = { ...DEFAULTS, ...(datos || {}) };
    for (const input of campos) {
      if (!Object.prototype.hasOwnProperty.call(origen, input.name)) continue;
      const valor = origen[input.name] == null ? "" : String(origen[input.name]);
      if (input.type === "radio") input.checked = input.value === valor;
      else input.value = valor;
    }
  }

  function cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE) || "null");
      aplicar(guardado && typeof guardado === "object" ? guardado : DEFAULTS);
      if (guardado && guardado.modo == null) {
        const directo = form.querySelector('input[name="modo"][value="directo"]');
        if (directo) directo.checked = true;
      }
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
    if (input.type === "radio" || !field) return;
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

  function bloqueGanancia(modalidad, tipo, porcentajes) {
    const caja = document.createElement("div");
    caja.className = tipo === "con" ? "ganancia-modo con" : "ganancia-modo sin";
    const titulo = document.createElement("h3");
    titulo.textContent = tipo === "con" ? "Con cuotas" : "Sin cuotas";
    caja.append(titulo);

    if (!modalidad.ok) {
      const aviso = document.createElement("p");
      aviso.className = "nota";
      const detalle =
        tipo === "con" ? "comisión, IIBB, IVA y recargo por cuotas" : "comisión, IIBB e IVA";
      aviso.textContent = `No se puede calcular: la suma de ${detalle} es ${modalidad.sumaTexto} y tiene que ser menor que 100%.`;
      caja.append(aviso);
      return caja;
    }

    const importe = document.createElement("p");
    importe.className = "precio";
    importe.textContent = formatearPesos(modalidad.neto);
    const desglose = document.createElement("div");
    desglose.className = "desglose";
    desglose.append(
      fila("Precio publicado", formatearPesos(modalidad.precioCentavos)),
      fila(`Comisión de venta (${porcentajes.comision})`, formatearPesos(modalidad.comision)),
      fila(`IIBB (${porcentajes.iibb})`, formatearPesos(modalidad.iibb)),
      fila(`IVA (${porcentajes.iva})`, formatearPesos(modalidad.iva))
    );
    if (tipo === "con") {
      desglose.append(fila(`Recargo por cuotas (${porcentajes.cuotas})`, formatearPesos(modalidad.cuotas)));
    }
    desglose.append(fila("Costo del envío", formatearPesos(modalidad.envio)));
    caja.append(importe, desglose);
    return caja;
  }

  function pintarGanancia(datos) {
    const ganancia = gananciaPublicada(datos);
    const campo = document.getElementById("publicado");
    if (campo) pintarCampo(campo, ganancia.errorPublicado);

    if (ganancia.estado === "oculto") {
      cardGanancia.hidden = true;
      cardGanancia.replaceChildren();
      return;
    }

    cardGanancia.hidden = false;
    cardGanancia.replaceChildren();
    const kicker = document.createElement("h2");
    kicker.className = "kicker";
    kicker.textContent = "Ganancia con el precio publicado";
    const caption = document.createElement("p");
    caption.className = "caption";
    caption.textContent = "Lo que te queda de ese precio después de los descuentos y del envío.";
    cardGanancia.append(kicker, caption);

    if (ganancia.estado !== "ok") {
      const aviso = document.createElement("p");
      aviso.className = "nota";
      aviso.textContent =
        ganancia.estado === "incompleto"
          ? "Completá la comisión, el envío y los porcentajes para ver la ganancia."
          : "Revisá el precio publicado y los cargos. Tienen que ser números iguales o mayores que cero.";
      cardGanancia.append(aviso);
      return;
    }

    const grilla = document.createElement("div");
    grilla.className = "ganancia-par";
    const porcentajes = porcentajesIngresados();
    grilla.append(
      bloqueGanancia(ganancia.sinCuotas, "sin", porcentajes),
      bloqueGanancia(ganancia.conCuotas, "con", porcentajes)
    );
    cardGanancia.append(grilla);
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

  function sincronizarForma() {
    const datos = leer();
    const porCosto = datos.modo === "costo";
    document.getElementById("panel-costo").hidden = !porCosto;
    document.getElementById("panel-directo").hidden = porCosto;
    const porcentaje = datos.tipoGanancia === "porcentaje";
    document.getElementById("ganancia-affix").textContent = porcentaje ? "%" : "$";
    document.getElementById("ganancia-hint").textContent = porcentaje
      ? "Porcentaje sobre el costo del producto. No se calcula sobre el precio de venta."
      : "Además de recuperar el costo. Se suma al costo para obtener el importe neto.";
    document.getElementById("ganancia").placeholder = porcentaje ? "30" : "3000";
  }

  function mostrarNetoCalculado(resultado) {
    const caja = document.getElementById("neto-resultado");
    if (resultado.modo === "costo" && resultado.netoUsadoCentavos != null) {
      caja.hidden = false;
      caja.textContent = `Importe neto: ${formatearPesos(resultado.netoUsadoCentavos)}. Sale del costo más la ganancia y es el que se usa para calcular el precio.`;
      return;
    }
    caja.hidden = true;
    caja.textContent = "";
  }

  function render() {
    sincronizarForma();
    const datos = leer();
    guardar();
    for (const input of campos) {
      pintarCampo(input, null);
    }

    const resultado = calcular(datos);
    pintarTasas(resultado.tasas);
    mostrarNetoCalculado(resultado);

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
        texto.textContent = datos.modo === "costo"
          ? "Completá el costo, la ganancia, la comisión y el envío para ver los precios. IIBB, IVA y el recargo por cuotas también tienen que tener un valor."
          : "Completá el importe neto, la comisión y el envío para ver los precios. IIBB, IVA y el recargo por cuotas también tienen que tener un valor.";
      } else {
        titulo.textContent = "Revisá los datos";
        texto.textContent = "Corregí los campos marcados. Los importes y porcentajes tienen que ser números iguales o mayores que cero.";
      }
      estado.append(titulo, texto);
      barraSin.textContent = "—";
      barraCon.textContent = "—";
      pintarGanancia(datos);
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
    pintarGanancia(datos);
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
