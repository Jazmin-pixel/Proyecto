import "./estilo.css"
import {
  avisar,
  crearEstado,
  drenar,
  obtenerResumen,
  terminarTurno,
  type Estado,
  type Zona,
} from "./juego"

const aplicacion = document.querySelector<HTMLDivElement>("#app")

if (!aplicacion) {
  throw new Error("No se encontró el contenedor principal de la aplicación.")
}

type Vista = "nueva" | "juego" | "final"
type Accion = "avisar" | "drenar"

let vista: Vista = "nueva"
let estado: Estado | null = null
let accionSeleccionada: Accion = "avisar"
let mensaje = ""

function colorDeZona(zona: Zona): string {
  if (zona.evacuada) {
    return "evacuada"
  }
  if (zona.inundada) {
    return "inundada"
  }
  if (zona.agua >= 5) {
    return "critica"
  }
  if (zona.agua >= 3) {
    return "riesgo"
  }
  return "tranquila"
}

function dibujarZona(zona: Zona): string {
  const estadoZona = zona.evacuada
    ? "evacuada"
    : zona.inundada
      ? "inundada"
      : `${zona.agua} niveles de agua`
  const quebrada = zona.quebrada ? " · quebrada" : ""
  const deshabilitada =
    zona.evacuada || zona.inundada || estado?.accionesRestantes === 0

  return `
    <button
      class="zona ${colorDeZona(zona)}"
      type="button"
      data-fila="${zona.fila}"
      data-columna="${zona.columna}"
      aria-label="Zona ${zona.fila + 1}, ${zona.columna + 1}: ${zona.familias} familias, ${estadoZona}${quebrada}"
      ${deshabilitada ? "disabled" : ""}
    >
      <span class="zona__nombre">Zona ${zona.fila + 1},${zona.columna + 1}</span>
      <span class="zona__familias">${zona.familias} fam.</span>
      <span class="zona__agua">${zona.evacuada ? "A salvo" : zona.inundada ? "Inundada" : `Agua ${zona.agua}`}</span>
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
      <div class="dato"><span>Turno</span><strong>${resumen.turno} / 8</strong></div>
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
        <button class="boton boton--accion ${accionSeleccionada === "avisar" ? "seleccionado" : ""}" type="button" data-accion="avisar" aria-pressed="${accionSeleccionada === "avisar"}">Avisar</button>
        <button class="boton boton--accion ${accionSeleccionada === "drenar" ? "seleccionado" : ""}" type="button" data-accion="drenar" aria-pressed="${accionSeleccionada === "drenar"}">Drenar</button>
      </div>
      <p class="ayuda">${accionSeleccionada === "avisar" ? "Elegí una zona no inundada para evacuar a sus familias." : "Elegí una zona: bajará el agua ahí y en sus vecinas."}</p>
      <button class="boton boton--turno" type="button" data-terminar-turno>Terminar turno</button>
    </section>

    ${mensaje ? `<p class="mensaje" role="status">${mensaje}</p>` : ""}

    <section class="tablero" aria-label="Tablero de zonas">
      ${estado.zonas.map(dibujarZona).join("")}
    </section>
    <p class="leyenda" aria-label="Colores del tablero">
      <span><i class="muestra tranquila"></i>Tranquila</span>
      <span><i class="muestra riesgo"></i>En riesgo</span>
      <span><i class="muestra critica"></i>A punto de inundarse</span>
      <span><i class="muestra inundada"></i>Inundada</span>
      <span><i class="muestra evacuada"></i>Evacuada</span>
    </p>
  `
}

function dibujar(): void {
  if (vista === "nueva") {
    aplicacion.innerHTML = `
      <main class="pantalla pantalla--inicio">
        <p class="ceja">Tormenta · el turno de la comunidad</p>
        <h1>El agua está subiendo.</h1>
        <p class="introduccion">Coordiná a la comunidad: decidí a quién avisar primero y dónde abrir drenaje.</p>
        <div class="resumen-reglas">
          <p><strong>Tu objetivo:</strong> salvar al menos el 70 % de las familias en 8 turnos.</p>
          <p>Cada turno tenés 3 acciones. La fila inferior del tablero es la quebrada.</p>
        </div>
        <button class="boton boton--principal" type="button" data-nueva-partida>Empezar partida</button>
      </main>
    `
    return
  }

  if (!estado) {
    throw new Error("No hay una partida activa para mostrar.")
  }

  if (vista === "final") {
    const resumen = obtenerResumen(estado)
    aplicacion.innerHTML = `
      <main class="pantalla pantalla--final">
        <p class="ceja">Tormenta · resultado</p>
        <h1>${estado.resultado === "ganada" ? "La comunidad se salvó." : "La tormenta ganó esta vez."}</h1>
        <p class="introduccion">${resumen.familiasSalvadas} de ${resumen.familiasTotales} familias a salvo (${resumen.porcentajeSalvado.toFixed(1)} %).</p>
        <p class="resultado-secundario">${resumen.familiasPerdidas} familias perdidas · ${resumen.familiasEnRiesgo} todavía en riesgo</p>
        <button class="boton boton--principal" type="button" data-nueva-partida>Jugar de nuevo</button>
      </main>
    `
    return
  }

  aplicacion.innerHTML = `<main class="pantalla">${dibujarPartida()}</main>`
}

function iniciarPartida(): void {
  estado = crearEstado(Date.now())
  vista = "juego"
  accionSeleccionada = "avisar"
  mensaje = ""
  dibujar()
}

aplicacion.addEventListener("click", (evento: MouseEvent) => {
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
    dibujar()
    return
  }

  if (boton.hasAttribute("data-terminar-turno")) {
    terminarTurno(estado)
    mensaje = ""
    if (estado.resultado !== "en curso") {
      vista = "final"
    }
    dibujar()
    return
  }

  const fila = Number(boton.dataset.fila)
  const columna = Number(boton.dataset.columna)
  const accionValida =
    accionSeleccionada === "avisar"
      ? avisar(estado, fila, columna)
      : drenar(estado, fila, columna)

  mensaje = accionValida
    ? ""
    : "No se pudo realizar esa acción. Probá con otra zona."
  dibujar()
})

dibujar()
