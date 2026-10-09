import "./estilo.css"
import {
  avisar,
  CONFIG,
  crearEstado,
  drenar,
  obtenerEstadoVisualZona,
  obtenerResumen,
  terminarTurno,
  type Estado,
  type Zona,
} from "./juego"

const aplicacion = document.querySelector<HTMLDivElement>("#app")

if (!aplicacion) {
  throw new Error("No se encontró el contenedor principal de la aplicación.")
}

const contenedor = aplicacion

type Vista = "nueva" | "juego" | "final"
type Accion = "avisar" | "drenar"

let vista: Vista = "nueva"
let estado: Estado | null = null
let accionSeleccionada: Accion = "avisar"
let mensaje = ""

function dibujarZona(zona: Zona): string {
  const color = obtenerEstadoVisualZona(zona)
  const estadoZona = zona.evacuada
    ? "evacuada, familias a salvo"
    : zona.inundada
      ? "inundada, familias perdidas"
      : color === "critica"
        ? `a punto de inundarse, ${zona.agua} niveles de agua`
        : color === "riesgo"
          ? `en riesgo, ${zona.agua} niveles de agua`
          : `tranquila, ${zona.agua} niveles de agua`
  const quebrada = zona.quebrada ? " · quebrada" : ""
  const deshabilitada =
    zona.evacuada ||
    (accionSeleccionada === "avisar" && zona.inundada) ||
    estado?.accionesRestantes === 0
  const disponibilidad = deshabilitada
    ? zona.evacuada
      ? "ya evacuada, no disponible"
      : zona.inundada && accionSeleccionada === "avisar"
        ? "no disponible para avisar porque está inundada"
        : "no disponible porque no quedan acciones"
    : `disponible para ${accionSeleccionada === "avisar" ? "avisar" : "drenar"}`
  const simbolo =
    color === "evacuada"
      ? "✓"
      : color === "inundada"
        ? "■"
        : color === "critica"
          ? "!"
          : color === "riesgo"
            ? "▲"
            : "●"

  return `
    <button
      class="zona ${color}"
      type="button"
      data-fila="${zona.fila}"
      data-columna="${zona.columna}"
      aria-label="Zona ${zona.fila + 1}, ${zona.columna + 1}: ${zona.familias} familias, ${estadoZona}${quebrada}; ${disponibilidad}"
      ${deshabilitada ? "disabled" : ""}
    >
      <span class="zona__nombre">Zona ${zona.fila + 1},${zona.columna + 1}</span>
      <span class="zona__familias">${zona.familias} fam.</span>
      <span class="zona__agua"><span aria-hidden="true">${simbolo}</span> ${zona.evacuada ? "A salvo" : zona.inundada ? "Inundada" : `Agua ${zona.agua}`}</span>
    </button>
  `
}

function dibujarPartida(): string {
  if (!estado) {
    return ""
  }

  const resumen = obtenerResumen(estado)
  const progreso = Math.min(
    100,
    (resumen.familiasSalvadas / resumen.metaFamilias) * 100,
  )

  return `
    <header class="encabezado">
      <p class="ceja">Tormenta · el turno de la comunidad</p>
      <h1>El agua está subiendo</h1>
      <p class="introduccion">Avisá a las familias para ponerlas a salvo o drená el agua de una zona y sus vecinas.</p>
    </header>

    <section class="marcador" aria-label="Estado de la partida">
      <div class="dato"><span>Turno</span><strong>${resumen.turno} / ${CONFIG.TURNOS_MAXIMOS}</strong></div>
      <div class="dato"><span>Acciones</span><strong>${resumen.accionesRestantes}</strong></div>
      <div class="dato"><span>A salvo</span><strong>${resumen.familiasSalvadas}</strong></div>
      <div class="dato"><span>En riesgo</span><strong>${resumen.familiasEnRiesgo}</strong></div>
      <div class="dato"><span>Perdidas</span><strong>${resumen.familiasPerdidas}</strong></div>
      <div class="dato dato--meta">
        <span>Meta: ${resumen.metaFamilias} de ${resumen.familiasTotales} familias</span>
        <strong>${resumen.porcentajeSalvado.toFixed(1)} % a salvo</strong>
        <progress max="100" value="${progreso}" aria-label="Progreso hacia la meta"></progress>
      </div>
    </section>

    <section class="controles" aria-label="Acciones del turno">
      <div class="selector-accion" role="group" aria-label="Elegir acción">
        <button class="boton boton--accion ${accionSeleccionada === "avisar" ? "seleccionado" : ""}" type="button" data-accion="avisar" aria-label="Acción Avisar, ${accionSeleccionada === "avisar" ? "seleccionada" : "no seleccionada"}" aria-pressed="${accionSeleccionada === "avisar"}">Avisar</button>
        <button class="boton boton--accion ${accionSeleccionada === "drenar" ? "seleccionado" : ""}" type="button" data-accion="drenar" aria-label="Acción Drenar, ${accionSeleccionada === "drenar" ? "seleccionada" : "no seleccionada"}" aria-pressed="${accionSeleccionada === "drenar"}">Drenar</button>
      </div>
      <p class="ayuda">${accionSeleccionada === "avisar" ? "Elegí una zona no inundada para evacuar a sus familias." : "Elegí una zona: bajará el agua ahí y en sus vecinas."}</p>
      <button class="boton boton--turno" type="button" data-terminar-turno aria-label="Terminar turno ${resumen.turno}; ${resumen.accionesRestantes} acciones restantes">Terminar turno</button>
    </section>

    <p class="mensaje" role="status" aria-live="polite">${mensaje}</p>

    <section class="tablero" role="group" aria-label="Tablero de 25 zonas; fila inferior, la quebrada">
      ${estado.zonas.map(dibujarZona).join("")}
    </section>
    <p class="leyenda" aria-label="Colores del tablero">
      <span><i class="muestra tranquila" aria-hidden="true">●</i>Tranquila</span>
      <span><i class="muestra riesgo" aria-hidden="true">▲</i>En riesgo</span>
      <span><i class="muestra critica" aria-hidden="true">!</i>A punto de inundarse</span>
      <span><i class="muestra inundada" aria-hidden="true">■</i>Inundada</span>
      <span><i class="muestra evacuada" aria-hidden="true">✓</i>Evacuada</span>
    </p>
  `
}

function dibujar(foco?: string): void {
  if (vista === "nueva") {
    contenedor.innerHTML = `
      <main class="pantalla pantalla--inicio">
        <p class="ceja">Tormenta · el turno de la comunidad</p>
        <h1>El agua está subiendo.</h1>
        <p class="introduccion">Coordiná a la comunidad: decidí a quién avisar primero y dónde abrir drenaje.</p>
        <div class="resumen-reglas">
          <p><strong>Tu objetivo:</strong> salvar al menos el ${CONFIG.META_PORCENTAJE} % de las familias en ${CONFIG.TURNOS_MAXIMOS} turnos.</p>
          <p>Cada turno tenés ${CONFIG.ACCIONES_POR_TURNO} acciones. La fila inferior del tablero es la quebrada.</p>
        </div>
        <button class="boton boton--principal" type="button" data-nueva-partida aria-label="Empezar una partida nueva">Empezar partida</button>
      </main>
    `
    return
  }

  if (!estado) {
    throw new Error("No hay una partida activa para mostrar.")
  }

  if (vista === "final") {
    const resumen = obtenerResumen(estado)
    contenedor.innerHTML = `
      <main class="pantalla pantalla--final">
        <p class="ceja">Tormenta · resultado</p>
        <h1 tabindex="-1" data-enfoque-principal>${estado.resultado === "ganada" ? "La comunidad se salvó." : "La tormenta ganó esta vez."}</h1>
        <p class="introduccion">${resumen.familiasSalvadas} de ${resumen.familiasTotales} familias a salvo (${resumen.porcentajeSalvado.toFixed(1)} %).</p>
        <p class="resultado-secundario">${resumen.familiasPerdidas} familias perdidas · ${resumen.familiasEnRiesgo} todavía en riesgo</p>
        <button class="boton boton--principal" type="button" data-nueva-partida aria-label="Empezar una partida nueva">Jugar de nuevo</button>
      </main>
    `
  } else {
    contenedor.innerHTML = `<main class="pantalla">${dibujarPartida()}</main>`
  }

  const elementoEnfocado = foco
    ? contenedor.querySelector<HTMLElement>(foco)
    : null
  if (elementoEnfocado && !("disabled" in elementoEnfocado && elementoEnfocado.disabled)) {
    elementoEnfocado.focus()
  } else if (vista === "final") {
    contenedor.querySelector<HTMLElement>("[data-enfoque-principal]")?.focus()
  } else if (foco?.startsWith(".zona[data-fila")) {
    const siguienteZona = contenedor.querySelector<HTMLButtonElement>(
      ".zona:not(:disabled)",
    )
    if (siguienteZona) {
      siguienteZona.focus()
    } else {
      contenedor.querySelector<HTMLButtonElement>("[data-terminar-turno]")?.focus()
    }
  }
}

function iniciarPartida(): void {
  estado = crearEstado(Date.now())
  vista = "juego"
  accionSeleccionada = "avisar"
  mensaje = ""
  dibujar("[data-accion='avisar']")
}

contenedor.addEventListener("click", (evento: MouseEvent) => {
  const objetivo = evento.target
  if (!(objetivo instanceof Element)) {
    return
  }

  const boton = objetivo.closest<HTMLButtonElement>("button")
  if (!boton) {
    return
  }

  if (boton.hasAttribute("data-nueva-partida")) {
    iniciarPartida()
    return
  }

  if (!estado || vista !== "juego") {
    return
  }

  const accion = boton.dataset.accion
  if (accion === "avisar" || accion === "drenar") {
    accionSeleccionada = accion
    mensaje = ""
    dibujar(`[data-accion='${accion}']`)
    return
  }

  if (boton.hasAttribute("data-terminar-turno")) {
    terminarTurno(estado)
    mensaje = estado.resultado === "en curso"
      ? `Comienza el turno ${estado.turno}. El agua subió en todas las zonas.`
      : ""
    if (estado.resultado !== "en curso") {
      vista = "final"
    }
    dibujar(
      estado.resultado === "en curso"
        ? "[data-terminar-turno]"
        : undefined,
    )
    return
  }

  const fila = Number(boton.dataset.fila)
  const columna = Number(boton.dataset.columna)
  const accionValida =
    accionSeleccionada === "avisar"
      ? avisar(estado, fila, columna)
      : drenar(estado, fila, columna)

  mensaje = accionValida
    ? `${accionSeleccionada === "avisar" ? "Aviso enviado" : "Drenaje abierto"} en la zona ${fila + 1}, ${columna + 1}.`
    : "No se pudo realizar esa acción. Probá con otra zona."
  dibujar(
    `.zona[data-fila='${fila}'][data-columna='${columna}']`,
  )
})

dibujar()
