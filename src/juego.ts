const CONFIG = {
  FILAS: 5, // filas
  COLUMNAS: 5, // columnas
  FAMILIAS_MINIMAS: 1, // familias por zona
  FAMILIAS_MAXIMAS: 3, // familias por zona
  AGUA_INICIAL_MINIMA: 0, // niveles de agua
  AGUA_INICIAL_MAXIMA: 3, // niveles de agua
  TURNO_INICIAL: 1, // turno
  ACCIONES_POR_TURNO: 3, // acciones
  TURNOS_MAXIMOS: 8, // turnos
  AGUA_PARA_INUNDAR: 6, // niveles de agua
  REDUCCION_DRENAJE_ZONA: 3, // niveles de agua
  REDUCCION_DRENAJE_VECINA: 1, // niveles de agua
  LLUVIA_ZONA_NORMAL: 1, // niveles de agua por turno
  LLUVIA_ZONA_QUEBRADA: 2, // niveles de agua por turno
  META_PORCENTAJE: 70, // porcentaje de familias
  PORCENTAJE_TOTAL: 100, // porcentaje
  DISTANCIA_ENTRE_VECINAS: 1, // casilla de distancia ortogonal
} as const

export type Zona = {
  fila: number
  columna: number
  familias: number
  agua: number
  quebrada: boolean
  inundada: boolean
  evacuada: boolean
}

export type Estado = {
  zonas: Zona[]
  turno: number
  accionesRestantes: number
  resultado: "en curso" | "ganada" | "perdida"
}

export type Resumen = {
  turno: number
  accionesRestantes: number
  familiasTotales: number
  familiasSalvadas: number
  familiasEnRiesgo: number
  familiasPerdidas: number
  metaFamilias: number
  porcentajeSalvado: number
  resultado: Estado["resultado"]
}

export function crearGeneradorAzar(semilla: number): () => number {
  let estado = semilla >>> 0

  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let valor = estado
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1)
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61)
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296
  }
}

function enteroAleatorio(
  azar: () => number,
  minimo: number,
  maximo: number,
): number {
  return Math.floor(azar() * (maximo - minimo + 1)) + minimo
}

export function crearEstado(semilla: number): Estado {
  const azar = crearGeneradorAzar(semilla)
  const zonas: Zona[] = []

  for (let fila = 0; fila < CONFIG.FILAS; fila += 1) {
    for (let columna = 0; columna < CONFIG.COLUMNAS; columna += 1) {
      zonas.push({
        fila,
        columna,
        familias: enteroAleatorio(
          azar,
          CONFIG.FAMILIAS_MINIMAS,
          CONFIG.FAMILIAS_MAXIMAS,
        ),
        agua: enteroAleatorio(
          azar,
          CONFIG.AGUA_INICIAL_MINIMA,
          CONFIG.AGUA_INICIAL_MAXIMA,
        ),
        quebrada: fila === CONFIG.FILAS - 1,
        inundada: false,
        evacuada: false,
      })
    }
  }

  return {
    zonas,
    turno: CONFIG.TURNO_INICIAL,
    accionesRestantes: CONFIG.ACCIONES_POR_TURNO,
    resultado: "en curso",
  }
}

export function obtenerResumen(estado: Estado): Resumen {
  const familiasTotales = estado.zonas.reduce(
    (total, zona) => total + zona.familias,
    0,
  )
  const familiasSalvadas = estado.zonas.reduce(
    (total, zona) => total + (zona.evacuada ? zona.familias : 0),
    0,
  )
  const familiasPerdidas = estado.zonas.reduce(
    (total, zona) =>
      total + (zona.inundada && !zona.evacuada ? zona.familias : 0),
    0,
  )
  const familiasEnRiesgo =
    familiasTotales - familiasSalvadas - familiasPerdidas

  return {
    turno: estado.turno,
    accionesRestantes: estado.accionesRestantes,
    familiasTotales,
    familiasSalvadas,
    familiasEnRiesgo,
    familiasPerdidas,
    metaFamilias: Math.ceil(
      (familiasTotales * CONFIG.META_PORCENTAJE) /
        CONFIG.PORCENTAJE_TOTAL,
    ),
    porcentajeSalvado:
      (familiasSalvadas / familiasTotales) * CONFIG.PORCENTAJE_TOTAL,
    resultado: estado.resultado,
  }
}

function encontrarZona(
  estado: Estado,
  fila: number,
  columna: number,
): Zona | undefined {
  return estado.zonas.find(
    (zona) => zona.fila === fila && zona.columna === columna,
  )
}

function puedeActuar(estado: Estado): boolean {
  return (
    estado.resultado === "en curso" && estado.accionesRestantes > 0
  )
}

export function avisar(
  estado: Estado,
  fila: number,
  columna: number,
): boolean {
  if (!puedeActuar(estado)) {
    return false
  }

  const zona = encontrarZona(estado, fila, columna)
  if (!zona || zona.inundada || zona.evacuada) {
    return false
  }

  zona.evacuada = true
  estado.accionesRestantes -= 1
  return true
}

export function drenar(
  estado: Estado,
  fila: number,
  columna: number,
): boolean {
  if (!puedeActuar(estado)) {
    return false
  }

  const zona = encontrarZona(estado, fila, columna)
  if (!zona) {
    return false
  }

  for (const afectada of estado.zonas) {
    const distancia =
      Math.abs(afectada.fila - zona.fila) +
      Math.abs(afectada.columna - zona.columna)
    const reduccion =
      afectada === zona
        ? CONFIG.REDUCCION_DRENAJE_ZONA
        : distancia === CONFIG.DISTANCIA_ENTRE_VECINAS
          ? CONFIG.REDUCCION_DRENAJE_VECINA
          : 0

    afectada.agua = Math.max(
      CONFIG.AGUA_INICIAL_MINIMA,
      afectada.agua - reduccion,
    )
  }

  estado.accionesRestantes -= 1
  return true
}

function actualizarDerrotaImposible(estado: Estado): void {
  const resumen = obtenerResumen(estado)
  if (
    resumen.familiasSalvadas + resumen.familiasEnRiesgo <
    resumen.metaFamilias
  ) {
    estado.resultado = "perdida"
  }
}

export function terminarTurno(estado: Estado): boolean {
  if (estado.resultado !== "en curso") {
    return false
  }

  estado.accionesRestantes = 0

  for (const zona of estado.zonas) {
    zona.agua += zona.quebrada
      ? CONFIG.LLUVIA_ZONA_QUEBRADA
      : CONFIG.LLUVIA_ZONA_NORMAL

    if (zona.agua >= CONFIG.AGUA_PARA_INUNDAR) {
      zona.inundada = true
    }
  }

  actualizarDerrotaImposible(estado)

  if (estado.resultado === "en curso") {
    if (estado.turno === CONFIG.TURNOS_MAXIMOS) {
      const resumen = obtenerResumen(estado)
      estado.resultado =
        resumen.familiasSalvadas >= resumen.metaFamilias ? "ganada" : "perdida"
    } else {
      estado.turno += 1
      estado.accionesRestantes = CONFIG.ACCIONES_POR_TURNO
    }
  }

  return true
}
