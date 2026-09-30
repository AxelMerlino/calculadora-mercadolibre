# Calculadora de precios para MercadoLibre

Estimá el precio de publicación en MercadoLibre para recibir el importe neto que querés, después de los descuentos y del envío.

Es una estimación a partir de los cargos que ingresás. No tiene afiliación oficial con MercadoLibre.

Proyecto de Axel Maximiliano Merlino.

## Funcionalidades

- Importe neto deseado, después de los descuentos y del envío.
- Comisión de venta, IIBB, IVA y recargo por cuotas editables.
- IIBB inicia en 5 %, IVA en 9 % y el recargo por cuotas en 8,9 %.
- Costo de envío como importe fijo.
- Precio sin cuotas y precio con cuotas.
- Los porcentajes se calculan sobre el precio de venta y se suman en el denominador.
- El resultado sube al menor entero terminado en 999 que cubre el cálculo.
- Desglose de descuentos, envío e importe neto final sobre el precio ajustado.
- Rechaza porcentajes cuya suma sea igual o superior al 100 %.
- Importes en pesos, con decimales usando coma o punto.
- Copia el precio, recuerda los últimos valores y permite restablecerlos.

## Tecnologías

HTML, CSS y JavaScript en el navegador. No usa backend ni dependencias.

## Instalación y ejecución

No hace falta instalar nada. Abrí `index.html` en el navegador.

Para comprobar el cálculo:

```bash
node test-calculo.js
```

## Ejemplo

Importe neto deseado: $12.000. Envío: $2.000. Comisión: 13 %. IIBB: 5 %. IVA: 9 %. Recargo por cuotas: 8,9 %.

El numerador es 12.000 + 2.000 = 14.000.

- Sin cuotas, los cargos suman 27 %: 14.000 / 0,73 = 19.178,08…, que se publica en **$19.999,00**.
- Con cuotas, los cargos suman 35,9 %: 14.000 / 0,641 = 21.840,87…, que se publica en **$21.999,00**.

## Cálculo

```text
precio = (importe neto deseado + envío) / (1 - suma de porcentajes / 100)
```

Para la modalidad con cuotas, el recargo entra en esa suma. No se agrega después sobre el precio sin cuotas.

Si el precio base es 16.566, el precio de publicación es 16.999. Si ya termina en 999, se mantiene.
